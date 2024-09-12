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
import { samLogger } from "../js/mzsam-logger.js";
import { i18n } from "../js/mzsam-i18n.js";
import { samPrefs } from "../js/mzsam-options.js";
import { samReport } from "../js/mzsam-report.js";
import { samUtils } from "../js/mzsam-utils.js";

document.addEventListener('DOMContentLoaded', async () => {
    samStore.do_debug = await samPrefs.getPref("do_debug");
    samPrefs.logger = new samLogger("mzsam-options", samStore.do_debug);

    let destfoldertype_select = document.getElementById("dest_folder_type");
    destfoldertype_select.addEventListener("change", showDestFolderOptions);

    samPrefs.restoreOptions();
    i18n.updateDocument();
    document.querySelectorAll(".option-input").forEach(element => {
      element.addEventListener("change", samPrefs.saveOptions);
    });
  }, { once: true });
  
  function showDestFolderOptions(){
    let destfoldertype_select = document.getElementById("dest_folder_type");
    //console.log(">>>>>>>>>>>>> destfoldertype_select.value: " + destfoldertype_select.value);
    let show_prefix = (destfoldertype_select.value === "subfolder") ? "table-row" : "none";
    
    document.querySelectorAll(".dest_folder_type_subfolder").forEach(element => {
      element.style.display = show_prefix;
    });
  }

  document.getElementById('btnManageReports').addEventListener('click', async () => {
    let report_data = await samReport.getAllReportData();
    report_data = samReport.sortReportsByDate(report_data);
    // console.log(">>>>>>>>>>>>> report_data: " + JSON.stringify(report_data));
    populateTable(report_data);
    document.getElementById("table-reports-container").style.display = "flex";
    document.getElementById('btnManageReports').style.display = "none";
    document.getElementById("storedReportsTitle").style.display = "inline-block";
  });

  document.getElementById('btnDeleteReports').addEventListener('click', () => {
    if(confirm(browser.i18n.getMessage("confirm_delete_reports"))) {
      samReport.clearReportData();
      let cont = document.getElementById("table-reports-container");
      cont.innerHTML = '';
      cont.innerText = browser.i18n.getMessage("reports_deleted");
    }
  })

  function populateTable(data) {
    // Get the table body
    const tableBody = document.querySelector("#reports_store tbody");
    
    // Clear existing rows in the table body
    tableBody.innerHTML = '';

    if((data == undefined) || (Object.keys(data).length === 0)) {
      document.getElementById("table-reports-container").innerText = browser.i18n.getMessage("no_reports_found");
      return;
    }

    // Loop through the data array and create table rows
    for (const report of Object.values(data)) {
      // Create a new row element
      const row = document.createElement('tr');
      
      // Create and append Date cell with link image
      const dateCell = document.createElement('td');
      const linkImage = document.createElement('img');
      linkImage.src = "../images/report_link.png";
      let OpenReportText = browser.i18n.getMessage("OpenReport");
      linkImage.alt = OpenReportText;
      linkImage.title = OpenReportText;
      linkImage.classList.add("report_link_img");
      linkImage.addEventListener("click", event => {
        event.stopPropagation();
        samReport.openReportTab(report.report_id, true);
      });
      dateCell.appendChild(linkImage);
      dateCell.appendChild(document.createTextNode(samUtils.formatDateString(report.report_date)));
      row.appendChild(dateCell);
      
      // Create and append Folder cell
      const folderCell = document.createElement('td');
      folderCell.textContent = report.current_folder;
      row.appendChild(folderCell);

      // Create and append Info cell
      const infoCell = document.createElement('td');
      infoCell.textContent = report.tot_messages + "/" + report.tot_moved + "/" + report.tot_dest_not_found + "/" + report.tot_related_msg_not_found;
      row.appendChild(infoCell);

      // Create and append Elapsed cell
      const elapsedCell = document.createElement('td');
      elapsedCell.textContent = samUtils.convertFromMilliseconds(report.elapsed_time);
      row.appendChild(elapsedCell);
      
      // Append the row to the table body
      tableBody.appendChild(row);
    }
  }