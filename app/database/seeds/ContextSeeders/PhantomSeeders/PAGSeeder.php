<?php namespace ContextSeeders\PhantomSeeders;
/**
 * This file is part of the Go-Smart Simulation Architecture (GSSA).
 * Go-Smart is an EU-FP7 project, funded by the European Commission.
 *
 * Copyright (C) 2013-  NUMA Engineering Ltd. (see AUTHORS file)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


use \DB;
use \Seeder;
use \Context;

class PAGSeeder extends Seeder {

  /**
   * Run the database seeds.
   *
   * @return void
   */
  public function run()
  {
    $pag = Context::create(['Family' => 'phantom', 'Name' => 'PAG']);

    $pag->attribute(['Name' => 'CONSTANT_BODY_TEMPERATURE', 'Type' => 'float', 'Value' => '37.0', 'Widget' => 'textbox']);
  }
}
