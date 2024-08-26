/*
 *  SentAutoMove [https://micz.it/thunderbird-addon-sentautomove/]
 *  Copyright (C) 2024  Mic (m@micz.it)

 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.

 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.

 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { samStore } from "../js/mzsam-store.js";
import { samReport } from "../js/mzsam-report.js";
import { samLogger } from "../js/mzsam-logger.js";
import { samPrefs } from "../js/mzsam-options.js";
import { i18n } from "../js/mzsam-i18n.js";


const urlParams = new URLSearchParams(window.location.search);
const report_id = urlParams.get('report_id');

const samLog = new samLogger("mzsam-report", samStore.do_debug);


document.addEventListener('DOMContentLoaded', async () => {
    samStore.do_debug = await samPrefs.getPref("do_debug");
    samPrefs.logger = samLog;
    i18n.updateDocument();

    let report = await samReport.loadReportData(report_id);

    if((report === undefined) || (report === null)) {
      samLog.log("Report Data is " + report);
      window.close();
      return;
    }

    setValue("current_folder", report.current_folder);
    setValue("current_account_id", report.current_account_id);
    setValue("tot_messages", report.tot_messages);
    setValue("tot_moved", report.tot_moved);
    setValue("tot_dest_not_found", report.tot_dest_not_found);

    samLog.log("Report Data: " + JSON.stringify(report));

  }, { once: true });


function setValue(id, value) {
  document.getElementById(id).innerText = value;
}