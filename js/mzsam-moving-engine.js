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


import { samStore } from "./mzsam-store.js";
import { samUtils } from "./mzsam-utils.js";
import { samLogger } from "./mzsam-logger.js";
import { samPrefs } from "./mzsam-options.js";
import { samReport } from "./mzsam-report.js";

export class movingEngine {

  logger = null;
  do_only_sent = true;
  do_only_same_account = true;
  dest_folder_type = '';
  dest_folder_prefix = '';
  ignore_archive_folders = true;
  min_moves_to_report = 0;

    // async sentMessageListener(sendInfo){
    //   if((sendInfo.mode == "sendNow") && (sendInfo.headerMessageId != undefined) && (sendInfo.headerMessageId != '')){
    //     let messages = getMessages(sendInfo.messages);
    //     await movingEngine.moveMessages([messages[0]]);
    //   }
    // },

    // async movedMessagesListener(originalMessages, movedMessages){
    //     await movingEngine.moveMessages(movedMessages);
    // },

    constructor(params){
      this.logger = new samLogger("mzsam-moving-engine", samStore.do_debug);
      samPrefs.logger = this.logger;
      samReport.logger = this.logger;
      this.logger.log("Constructor params: " + JSON.stringify(params));
      this.do_only_same_account = params.do_only_same_account;
      this.do_only_sent = params.do_only_sent;
      this.dest_folder_type = params.dest_folder_type;
      this.dest_folder_prefix = params.dest_folder_prefix;
      this.ignore_archive_folders = params.ignore_archive_folders;
      this.min_moves_to_report = params.min_moves_to_report;
    }


    async checkFolder(folder){
      let query_params = {}

      if(samStore.istb128orgreater){
        query_params = {
          folderId: folder.id,
        }
      }else{
        query_params = {
          folder: folder,
        }
      }
      
      this.logger.log("Checking folder [" + folder.name + "]");
      this.moveMessages(query_params, samUtils.getFolderAccountId(folder));
    }


    async moveMessages(query_params, account_id = 0){
        let messages = this.getMessages(messenger.messages.query(query_params));
        
        let report_data = {};
        let tot_messages = 0;
        let tot_moved = 0;
        let tot_dest_not_found = 0;

        report_data.current_folder = samStore.istb128orgreater ? (await messenger.folders.get(query_params.folderId)).name : query_params.folder.name;
        report_data.current_account_id = account_id;
        report_data.moved_messages = {};
        report_data.dest_not_found_messages = {};

        for await (let message of messages) {
           tot_messages++;
           //console.log(">>>>>>>>>>>> Original message.subject: [" + message.folder.name + "] " + message.subject);
           let related_message = await this.findRelatedMessage(message, account_id);
           if(related_message !== false){
            let dest_folder = false;
            switch(this.dest_folder_type){
              case 'subfolder':
                dest_folder = await this.getDestSubFolder(related_message,this.dest_folder_prefix);
                break;
              case 'same_folder':
                dest_folder = await this.getDestSameFolder(related_message);
                break;
            }
            if(dest_folder !== false){
              //await messenger.messages.move([message.id], samUtils.getParameter(dest_folder));  //commented out for testing
              tot_moved++;
              this.logger.log("Moving [" + message.subject + "] to [" + dest_folder.name + "] [" + message.headerMessageId + "]");
              report_data.moved_messages[message.headerMessageId] = {}
              report_data.moved_messages[message.headerMessageId].headerMessageId = message.headerMessageId;
              report_data.moved_messages[message.headerMessageId].dest_folder = dest_folder.name;
              report_data.moved_messages[message.headerMessageId].subject = message.subject;
            }else{
              tot_dest_not_found++;
              this.logger.log("No dest folder found for [" + message.folder.name + "] " + message.subject + " [" + message.headerMessageId + "]");
              report_data.dest_not_found_messages[message.headerMessageId] = {}
              report_data.dest_not_found_messages[message.headerMessageId].headerMessageId = message.headerMessageId;
              report_data.dest_not_found_messages[message.headerMessageId].relmessage_folder = related_message.folder.name;
              report_data.dest_not_found_messages[message.headerMessageId].subject = message.subject;
            }
           }
        }
        // TODO improve messages with single, plural and 0 messages
        samUtils.showNotification("Sent Auto Move", "Operation completed\n"  + tot_messages + " messages analyzed\n" + tot_moved + " moved\n" + tot_dest_not_found + " not moved: destination folder not found");
        this.logger.log("Operation completed: " + tot_messages + " messages analyzed, " + tot_moved + " messages moved, " + tot_dest_not_found + " messages not moved: dest folder not found.");
        
        let report_id = account_id + "_" + (new Date()).toISOString().replace(/[-.]/g, '').replace(/T/, '').replace(/Z/, '') + "_" + Math.floor(Math.random() * 10000);
        report_data.tot_messages = tot_messages;
        report_data.tot_moved = tot_moved;
        report_data.tot_dest_not_found = tot_dest_not_found;

        await samReport.saveReportData(report_data, report_id);
        if(tot_moved >= this.min_moves_to_report){
          samReport.openReportTab(report_id);
        }
    }


    async findRelatedMessage(message, account_id = 0){        // this method finds the message related to the one passed to it

      let fullMsg = await messenger.messages.getFull(message.id);
      // console.log(">>>>>>>>>>>> fullMsg: " + JSON.stringify(fullMsg.headers));
      let inReplyToHeaders = fullMsg.headers['in-reply-to'];
      //console.log(">>>>>>>>>>>> inReplyToHeaders: " + inReplyToHeaders);

      if(inReplyToHeaders != undefined){
        let query_params = {
          headerMessageId: Array.isArray(inReplyToHeaders) ? inReplyToHeaders[0].replace(/^<|>$/g, '') : inReplyToHeaders.replace(/^<|>$/g, ''),
          // the search should be limited to the current account (with an option to choose if limiting to the current account or all accounts)
        }

        let found_messages = null;
        //only from this account
        if(this.do_only_same_account){
          if(samStore.istb128orgreater){  //TB128
            //query_params.accountId = samUtils.getFolderAccountId(message.folder);
            query_params.folderId = await samUtils.getAccountFoldersIds(samUtils.getFolderAccountId(message.folder));
          }else{  // TB 115
            found_messages = this.getAccountMessages(query_params, account_id);
          }
        }

        if(found_messages == null) found_messages = this.getMessages(messenger.messages.query(query_params));

        // TODO check also the header "References"? At the moment no...

        for await (let found_msg of found_messages) {
          this.logger.log("Related found_msg.subject: [" + found_msg.folder.name + "] " + found_msg.subject + " [" + message.headerMessageId + "]");
          // get only the first one at the moment
          return found_msg;
        }
      }
      return false;
    }

    async getDestSubFolder(message, prefix){
      let currentFolder = message.folder;
      let subFolders = null;

      subFolders = await messenger.folders.getSubFolders(samUtils.getParameter(currentFolder), true);

      for (let subFolder of subFolders) {
        if (subFolder.name.startsWith(prefix)) {
            return subFolder;
        }
      }
      return false;
    }

    async getDestSameFolder(message){
      let currentFolder = message.folder;
      if (!["trash", "templates", "drafts", "junk", "outbox", "inbox", "sent"].includes(currentFolder.type)) {
          return currentFolder;
      }
      return false;
    }

  async *getMessages(list) {
    let page = await list;

    for (let message of page.messages) {
      yield message;
    }
  
    while (page.id) {
      page = await messenger.messages.continueList(page.id);
      for (let message of page.messages) {
        yield message;
      }
    }
  }



  // TB 115 only
  async *getAccountMessages(queryInfo, account_id = 0) {
    if(account_id == 0) {
      yield* this.getMessages(browser.messages.query(queryInfo));
      return;
    }
    // console.log(">>>>>>>>>> getAccountMessages queryInfo: " + JSON.stringify(queryInfo));
    // console.log(">>>>>>>>>> getAccountMessages account_id: " + account_id);
    let account = await browser.accounts.get(account_id, true);
    let folders = await browser.folders.getSubFolders(account);

    //console.log(">>>>>>>>>> getAccountMessages folders: " + JSON.stringify(folders));

    for (let folder of folders) {
      if(["trash", "templates", "drafts", "junk", "outbox"].includes(folder.type)) continue;
      if(this.ignore_archive_folders && folder.type == "archive") {
        continue;
      }
      yield* this.processFolderAndSubfolders(folder, queryInfo, account_id);
    }
  }

  async *processFolderAndSubfolders(folder, queryInfo, account_id) {

    //console.log(`>>>>>>>> processFolderAndSubfolders Listing messages for folder: ${folder.name}, path: ${folder.path}`);
    queryInfo.folder = folder;
    // console.log(">>>>>>>>>> processFolderAndSubfolders queryInfo: " + JSON.stringify(queryInfo));
    yield* this.getMessages(browser.messages.query(queryInfo));

    let subfolders = await browser.folders.getSubFolders(folder);
    for (let subfolder of subfolders) {
        yield* this.processFolderAndSubfolders(subfolder, queryInfo, account_id);
    }
  }

}