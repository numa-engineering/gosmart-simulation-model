var session = null;
var statuses = {};
var chosenSimulations = [];
var servers = {};
var simulationToServer = {};

function showAjaxError(jqXHR) {
  showError(id, jqXHR.data.msg);
};

var connection = new autobahn.Connection({
  url: "ws://www.numa.oan:8081/ws",
  realm: "realm1"
});

connection.onopen = function (newSession, details) {
  session = newSession;
  session.subscribe('com.gosmartsimulation.announce', onAnnounce)
  session.subscribe('com.gosmartsimulation.identify', onIdentify)
  session.subscribe('com.gosmartsimulation.status', onStatus)
  session.publish('com.gosmartsimulation.request_announce', [])
  session.subscribe('com.gosmartsimulation.complete', onComplete)
  session.subscribe('com.gosmartsimulation.fail', onFail)
  requestIdentify();
};

connection.onclose = function (reason, details) {
};

function setProgress(tr, percentage)
{
  if (!isNaN(parseFloat(percentage)))
  {
    percentage = Math.round(percentage * 10) / 10;
    tr.find('td[name=simulation-server-progress] span').html(percentage + '%');
    tr.find('td[name=simulation-server-progress] div').css('width', percentage + 'px');
  }
  else
  {
    tr.find('td[name=simulation-server-progress] span').html('');
    tr.find('td[name=simulation-server-progress] div').css('width', '0px');
  }
}

function freestServer()
{
  var maxScore = null, maxServer = null;
  for (server in servers)
    if (maxServer === null || servers[server].score > maxScore)
    {
      maxServer = server;
      maxScore = servers[server].score;
    }

  return maxServer;
}

function onFail(args) {
  statuses[args[0]] = ['fail', args[1]];
  showError(args[0], args[1]);
  requestIdentify();
}

function onComplete(args) {
  statuses[args[0]] = ['complete', null];
  showComplete(args[0]);
  requestIdentify();
}

function showComplete(id) {
  var simulation = $('#' + id);
  if (simulation.length == 0)
    return;

  simulation.find('td[name=simulation-server-status] a').css('visibility', 'visible');
  simulation.find('td[name=simulation-server-status]').css('background-color', 'green');
  simulation.find('td[name=simulation-server-message]').html("Success");
  setProgress(simulation);
}

function showError(id, res) {
  var simulation = $('#' + id);
  if (simulation.length == 0)
    return;

  simulation.find('td[name=simulation-server-status] a').css('visibility', 'visible');
  simulation.find('td[name=simulation-server-status]').css('background-color', 'red');
  if (res)
    simulation.find('td[name=simulation-server-message]').html('[' + res.id + ':' + res.code + '] ' + res.message);
  setProgress(simulation);
}

function showDatabaseRequest(id, res) {
  var simulation = $('#' + id);
  if (simulation.length == 0)
    return;

  simulation.find('td[name=simulation-server-status] a').css('visibility', 'hidden');
  simulation.find('td[name=simulation-server-status]').css('background-color', 'brown');
  simulation.find('td[name=simulation-server-message]').html(res);
  setProgress(simulation);
}

function showProperties(id, res) {
  var simulation = $('#' + id);
  if (simulation.length == 0)
    return;

  if (res.location)
  {
    simulation.find('td[name=simulation-server-message]').prop('title', res.location);
    simulation.find('span[name=location]').html(res.location);
    simulation.find('.location').css('visibility', 'visible');
  }
  else
  {
    simulation.find('td[name=simulation-server-message]').prop('title', '');
    simulation.find('span[name=location]').html('');
    simulation.find('.location').css('visibility', 'hidden');
  }
}

function pickSimulation(id) {
  var index = chosenSimulations.indexOf(id);
  var simulation = $('#' + id);
  if (simulation.length == 0)
    return;

  if (index > -1) {
    chosenSimulations.splice(index, 1);
    simulation.css('background-color', 'inherit');
  }
  else {
    chosenSimulations.push(id);
    simulation.css('background-color', '#a66');
  }

  if (chosenSimulations.length == 2)
    $('#diffLink').removeClass('disabled')
  else
    $('#diffLink').addClass('disabled')
}

function showMessage(id, res) {
  var simulation = $('#' + id);
  if (simulation.length == 0)
    return;

  simulation.find('td[name=simulation-server-status] a').css('visibility', 'hidden');
  simulation.find('td[name=simulation-server-status]').css('background-color', 'yellow');
  simulation.find('td[name=simulation-server-message]').html(res);
  setProgress(simulation);
}

function rebuildSimulation(id) {
  var rebuildLink = $('#' + id + ' a[name=rebuild]').attr('href');

  $.get(rebuildLink, [], function (data) {
    alert(data.msg);
    regenerateBoard();
  }).fail(showAjaxError);
}

function duplicateSimulation(id) {
  var dupLink = $('#' + id + ' a[name=duplicate]').attr('href');

  if (session)
  {
    var sE = function(err) { showError(id, err.args[0]); };

    $.get(dupLink, [], function (simulation) {
      simulations[simulation.Id] = simulation;
      regenerateBoard();
    });
  }
  else
  {
    console.error('No WAMP session available for simulation server connection');
  }
}

function diffSimulations(idThis, idThat) {
  var xmlThisLink = $('#' + idThis + ' a[name=xml-link]').attr('href');
  var xmlThatLink = $('#' + idThat + ' a[name=xml-link]').attr('href');

  $.when(
      $.get(xmlThisLink),
      $.get(xmlThatLink)
  ).done(function (responseThis, responseThat) {
    var xmlThis = (new XMLSerializer()).serializeToString(responseThis[0]);
    var xmlThat = (new XMLSerializer()).serializeToString(responseThat[0]);
    var s = freestServer();
    session.call('com.gosmartsimulation.' + s + '.compare', [xmlThis, xmlThat]).then(function (difflines) {
      var w = window.open();
      var body = $(w.document.body);
      var pre = $("<pre></pre>");
      pre.appendTo(body);
      for (line in difflines) {
        pre.append(difflines[line] + "\n");
      }
    });
  });
}

function startSimulation(id) {
  var xmlLink = $('#' + id + ' a[name=xml-link]').attr('href');

  if (session)
  {
    var sE = function(err) { showError(id, err.args[0]); };

    showDatabaseRequest(id, 'Retrieving XML');
    $.get(xmlLink, [], function (xml) {
      var s = freestServer();
      session.call('com.gosmartsimulation.' + s + '.init', [id]).then(function (res) {
        showMessage(id, "Initiated");
        var xmlString = (new XMLSerializer()).serializeToString(xml);
        session.call('com.gosmartsimulation.' + s + '.update_settings_xml', [id, xmlString]).then(function (res) {
          showMessage(id, "XML set");
          session.call('com.gosmartsimulation.' + s + '.finalize', [id, '.']).then(function (res) {
            showMessage(id, "Settings finalized");
            session.call('com.gosmartsimulation.' + s + '.start', [id]).then(function (res) {
              showMessage(id, "Started...");
              session.call('com.gosmartsimulation.' + s + '.properties', [id]).then(function (res) {
                showProperties(id, res);
              }, sE);
            }, sE); }, sE); }, sE); }, sE);
    }, 'xml');
  }
  else
  {
    console.error('No WAMP session available for simulation server connection');
  }
}

function regenerateBoard() {
  var table = $('.simulations-table');
  table.empty();
  var clinicians = {"None": {"simulations": [], "UserName": "[none]"}};
  var sortedSimulations = Object.keys(simulations).sort(function (a, b) {
    if (!simulations[a].modality)
      return simulations[b].modality ? -1 : 0;
    if (!simulations[b].modality)
      return 1;
    var strcmp = simulations[a].modality.Id.localeCompare(simulations[b].modality.Id);
    if (strcmp != 0)
      return strcmp;
    if (!simulations[a].creationDate)
      return simulations[b].creationDate ? -1 : 0;
    if (!simulations[b].creationDate)
      return 1;
    return simulations[a].creationDate.localeCompare(simulations[b].creationDate);
  });

  sortedSimulations.forEach(function (Id)
  {
    var simulation = simulations[Id];

    if (!simulation.clinician)
    {
      clinicians["None"].simulations.push(simulation);
      return;
    }

    var clinician = simulation.clinician;

    if (!(simulation.clinician.Id in clinicians))
    {
      clinicians[simulation.clinician.Id] = clinician;
      clinician.simulations = [];
    }
    clinicians[simulation.clinician.Id].simulations.push(simulation);
  });

  for (clinicianId in clinicians)
  {
    var clinician = clinicians[clinicianId];

    table.append('<tr><td><div><h2 title="' + clinicianId + '">' + clinician.UserName + '</h2><table id="clinician-' + clinicianId + '"></table></div></td></tr>');
    var clinicianTable = $('#clinician-' + clinicianId);
    for (var i = 0; i < clinician.simulations.length; i++)
    {
      var simulation = clinician.simulations[i];
      var Id = simulation.Id;
      var classes = 'simulation';
      if (simulation.isDeleted)
        classes += ' deleted';
      clinicianTable.append('<tr id="' + Id + '" class="' + classes + '">');
      var tr = clinicianTable.find('#' + Id);
      tr.append('<td name="simulation-server-status"><a href="#" name="start">&#9658;</a></td>');

      tools =
          '<a href="' + duplicateLink(Id) + '" title="Duplicate" name="duplicate">&#9842;</a>'
          + '<a href="#" title="Pick" name="pick">&#9935;</a>'
          + '<a href="' + rebuildLink(Id) + '" title="Rebuild" name="rebuild">&#x1f3ed;</a>';

      if (simulation.hasSegmentedLesion)
          tools += '<a href="' + segmentedLesionLink(Id) + '" title="Segmented lesion" target="segmentedLesion" name="segmentedLesion">&#x1f359;</a>';

      tr.append('<td name="simulation-tools">'
          + tools
          + '</td>');
      if (simulation.modality)
        tr.append('<td class="modality-indicator modality-' + simulation.modality.Name + '"></td>');
      else
        tr.append('<td></td>');
      tr.append('<td name="name">' + simulation.asHtml + ' [' + simulation.creationDate + ']<br/><span style="font-size:xx-small">'
          + simulation.asString + '</span>' + ' <span class="location">[<span name="location"></span>]</span></td>');
      if (simulation.interactive === false)
      {
        tr.append('<td></td>');
      }
      else
      {
        tr.append('<td>[<span style="font-size: xx-small"><a href="' + editLink(Id) + '">e</a>'
          + '<a href="' + xmlLink(Id) + '" name="xml-link">X</a><a href="' + htmlLink(Id) + '">H</a></span>]</td>');
      }
      tr.append('<td name="simulation-server-progress"><span name="progress-number"></span><div name="progress-bar"></div></td>');
      tr.append('<td id="simulation-' + Id + '-parameter" class="combination-parameters"></td>');
      tr.append('<td name="simulation-server-message"></td>');
      tr.find('a[name=pick]').unbind("click");
      tr.find('a[name=pick]').bind("click", handlePick);
      tr.find('a[name=start]').unbind("click");
      tr.find('a[name=start]').bind("click", handleStart);
      tr.find('a[name=rebuild]').unbind("click");
      tr.find('a[name=rebuild]').bind("click", handleRebuild);
      tr.find('a[name=duplicate]').unbind("click");
      tr.find('a[name=duplicate]').bind("click", handleDuplicate);
      reshowStatus(Id);
    }
  }
}

function reshowStatus(id)
{
  if (!(id in statuses))
    return;

  var condition = statuses[id][0];
  var detail = statuses[id][1];
  if (condition == 'complete')
    showComplete(id);
  else if (condition == 'fail')
    showError(id, detail);
  else if (condition == 'status')
    showStatus(id, detail[0], detail[1]);
}

function onStatus(args) {
  var id = args[0];
  var percentage = args[1];
  var statusMessage = args[2];
  statuses[id] = ['status', [percentage, statusMessage]];
  showStatus(id, percentage, statusMessage);
}

function showStatus(id, percentage, statusMessage) {
  var tr = $('#' + id);
  if (tr.length > 0)
  {
    tr.find('td[name=simulation-server-message]').html(statusMessage);
    setProgress(tr, percentage);
  }
}

function requestIdentify() {
  session.publish('com.gosmartsimulation.request_identify', [])
}

function updateServers() {
  var tbody = $('#servers-table');
  tbody.empty();
  for (server in servers)
  {
    var score = servers[server].score;
    var hostname = servers[server].host;
    tbody.append('<tr><td>' + server + '</td><td>' + hostname + '</td><td>' + score + '</td></tr>');
  }
}

function onIdentify(args) {
  var serverId = args[0];
  var hostname = args[1];
  var score = args[2];
  servers[serverId] = {id: serverId, host: hostname, score: score};
  updateServers();
}

function onAnnounce(args) {
  var tr;

  //if ($('#' + args[0]).length == 0)
  //{
  //  simulations[args[0]] = {"Id": args[0], "asHtml": "[-- Unknown --]", "asString": "", "interactive": false};
  //}

  serverId = args[0];
  tr = $('#' + args[1]);
  simulationToServer[args[1]] = serverId;

  if (args[2])
  {
    stat = args[2][1];
    if (stat.code == 'SUCCESS')
    {
      onComplete([args[1]]);
    }
    else if (stat.code == 'IN_PROGRESS')
    {
      onStatus([args[1], args[2][0], stat.message]);
    }
    else
    {
      onFail([args[1], stat]);
    }
  }

  var properties = {location: args[2]};
  showProperties(args[0], properties);

  //regenerateBoard();
};

function handleRebuild(e) {
  e.preventDefault();
  var simulation = $(e.target).closest('tr').attr('id');
  rebuildSimulation(simulation);
}

function handleDuplicate(e) {
  e.preventDefault();
  var simulation = $(e.target).closest('tr').attr('id');
  duplicateSimulation(simulation);
}

function handlePick(e) {
  e.preventDefault();
  var simulation = $(e.target).closest('tr').attr('id');
  pickSimulation(simulation);
}

function handleStart(e) {
  e.preventDefault();
  var simulation = $(e.target).closest('tr').attr('id');
  startSimulation(simulation);
}

function handleDiff(e) {
  e.preventDefault();
  if (chosenSimulations.length == 2)
    diffSimulations(chosenSimulations[0], chosenSimulations[1]);
  else
    alert("Must pick exactly two simulations");
}

$(function () {
  connection.open();
  $('#diffLink').click(handleDiff);
  regenerateBoard();
});
