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
import { samUtils } from "../js/mzsam-utils.js";
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

    document.title = "SentAutoMove " + browser.i18n.getMessage("Report") + " " + samUtils.formatDateString_Short(report.report_date);

    setValue("current_folder", report.current_folder);
    setValue("current_account_id", report.current_account_id != -1 ? await samUtils.getAccountName(report.current_account_id) : browser.i18n.getMessage("executedFromSelection"));
    setValue("tot_messages", report.tot_messages);
    setValue("tot_moved", report.tot_moved);
    setValue("tot_dest_not_found", report.tot_dest_not_found);
    setValue("tot_related_msg_not_found", report.tot_related_msg_not_found);
    setValue("report_date", samUtils.formatDateString(report.report_date));
    setValue("elapsed_time", samUtils.convertFromMilliseconds(report.elapsed_time));

    if(Object.keys(report.moved_messages).length > 0) renderReport(1,report.moved_messages, document.getElementById('miczMsgMovedList'));
    if(Object.keys(report.dest_folder_not_found_messages).length > 0) renderReport(2,report.dest_folder_not_found_messages, document.getElementById('miczDestFolderNotFoundList'));
    if(Object.keys(report.related_msg_not_found_messages).length > 0) renderReport(3,report.related_msg_not_found_messages, document.getElementById('miczRelatedMsgNotFoundList'));

    //console.log(">>>>>>>>>> report: " + JSON.stringify(report));

    samLog.log("Report Data: " + JSON.stringify(report));

    document.querySelectorAll(".list-counter").forEach(element => {
      const data_id = element.getAttribute('data-id');
      if(Object.keys(report[data_id]).length > 0){
        element.classList.add("pointer");
        element.title = "Show messages list";
      }
      element.addEventListener("click", function() {
        if(Object.keys(report[data_id]).length == 0){
          return;
        }
        switch(data_id){
          case 'moved_messages':
            document.getElementById('miczMsgMovedList').style.display = "table";
            document.getElementById('miczDestFolderNotFoundList').style.display = "none";
            document.getElementById('miczRelatedMsgNotFoundList').style.display = "none";
            break;
          case 'dest_folder_not_found_messages':
            document.getElementById('miczMsgMovedList').style.display = "none";
            document.getElementById('miczDestFolderNotFoundList').style.display = "table";
            document.getElementById('miczRelatedMsgNotFoundList').style.display = "none";
            break;
          case 'related_msg_not_found_messages':
            document.getElementById('miczMsgMovedList').style.display = "none";
            document.getElementById('miczDestFolderNotFoundList').style.display = "none";
            document.getElementById('miczRelatedMsgNotFoundList').style.display = "table";
            break;
        }
      });
    });

  }, { once: true });


function setValue(id, value) {
  document.getElementById(id).innerText = value;
}

// Function to render messages as a table
// type 1: moved_messages, 2: dest_folder_not_found_messages, 3: related_msg_not_found_messages
function renderReport(type, dataList, containerDiv) {

  // Create a title element for the table
  const titleElement = document.createElement('h2');
  titleElement.className = 'table-title';
  titleElement.textContent = browser.i18n.getMessage("Report");

  // Customize the title based on the type of report
  switch (type) {
    case 1:
      titleElement.textContent = browser.i18n.getMessage("Moved") + ' ' + browser.i18n.getMessage("Messages");
      break;
    case 2:
      titleElement.textContent = browser.i18n.getMessage("DestinationFolder") + ' ' + browser.i18n.getMessage("NotFound");
      break;
    case 3:
      titleElement.textContent = browser.i18n.getMessage("RelatedMessageFolder") + ' ' + browser.i18n.getMessage("NotFound");
      break;
    default:
      titleElement.textContent = browser.i18n.getMessage("ReportTypeUndefined");
  }

  // Append the title to the container
  containerDiv.appendChild(titleElement);

  // Create a table wrapper div
  const tableDiv = document.createElement('div');
  tableDiv.className = 'table';

  // Create a header row
  const headerRow = document.createElement('div');
  headerRow.className = 'table-row header';

  // Create and append header cells
  const headerMessageId = document.createElement('div');
  headerMessageId.className = 'table-cell';
  headerMessageId.textContent = browser.i18n.getMessage("MessageID");

  const headerDate = document.createElement('div');
  headerDate.className = 'table-cell';
  headerDate.textContent = browser.i18n.getMessage("Date");

  let headerDestFolder = null;

  if(type != 3){
    headerDestFolder = document.createElement('div');
    headerDestFolder.className = 'table-cell';
    switch(type) {
      case 1:
        headerDestFolder.textContent = browser.i18n.getMessage("DestinationFolder");
        break;
      case 2:
        headerDestFolder.textContent = browser.i18n.getMessage("RelatedMessageFolder");
        break;
      default:
        headerDestFolder.textContent = browser.i18n.getMessage("ReportTypeUndefined");
        break;
    }
  }

  const headerSubject = document.createElement('div');
  headerSubject.className = 'table-cell';
  headerSubject.textContent = browser.i18n.getMessage("Subject");

  // Append header cells to the header row
  headerRow.appendChild(headerMessageId);
  headerRow.appendChild(headerDate);
  headerRow.appendChild(headerSubject);
  if(type != 3) headerRow.appendChild(headerDestFolder);

  // Append the header row to the table div
  tableDiv.appendChild(headerRow);

  // Iterate through the objects in dataList
  for (const messageId in dataList) {
      if (dataList.hasOwnProperty(messageId)) {
          const message = dataList[messageId];

          // Create a new row div for each message
          const messageRow = document.createElement('div');
          messageRow.className = 'table-row';

          // Create individual cells for each property
          const messageIdCell = document.createElement('div');
          messageIdCell.className = 'table-cell';
          messageIdCell.textContent = message.headerMessageId;

          const dateCell = document.createElement('div');
          dateCell.className = 'table-cell';
          dateCell.textContent = samUtils.formatDateString(message.date);

          let destFolderCell = null;

          if(type != 3){
            destFolderCell = document.createElement('div');
            destFolderCell.className = 'table-cell click-folder';
            switch(type) {
              case 1:
                destFolderCell.textContent = message.dest_folder;
                destFolderCell.onclick = function() { browser.mailTabs.create({displayedFolder: message.dest_folder_id});};
                break;
              case 2:
                destFolderCell.textContent = message.relmessage_folder;
                destFolderCell.onclick = function() { browser.mailTabs.create({displayedFolder: message.relmessage_folder_id});};
                break;
              default:
                destFolderCell.textContent = browser.i18n.getMessage("ReportTypeUndefined");
                break;
            }
          }

          const subjectCell = document.createElement('div');
          subjectCell.className = 'table-cell';
          subjectCell.textContent = message.subject;

          // Append cells to the message row
          messageRow.appendChild(messageIdCell);
          messageRow.appendChild(dateCell);
          messageRow.appendChild(subjectCell);
          if(type != 3) messageRow.appendChild(destFolderCell);

          // Append the message row to the table div
          tableDiv.appendChild(messageRow);
      }
  }

  // Append the table div to the container
  containerDiv.appendChild(tableDiv);
}

