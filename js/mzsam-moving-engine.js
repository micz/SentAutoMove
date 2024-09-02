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
        let start_time = performance.now();
        //set debug option
        this.logger.changeDebug(samStore.do_debug);

        let report_data = {};
        report_data.report_date = new Date();
        let tot_messages = 0;
        let tot_moved = 0;
        let tot_dest_not_found = 0;
        let tot_related_msg_not_found = 0;

        let messages = this.getMessages(messenger.messages.query(query_params));

        report_data.current_folder = samStore.istb128orgreater ? (await messenger.folders.get(query_params.folderId)).name : query_params.folder.name;
        report_data.current_account_id = account_id;
        report_data.moved_messages = {};
        report_data.dest_folder_not_found_messages = {};
        report_data.related_msg_not_found_messages = {};

        for await (let message of messages) {
          if(tot_messages >= 50) break; // to TEST only few messages
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
              report_data.moved_messages[message.headerMessageId].date = message.date;
            }else{
              tot_dest_not_found++;
              this.logger.log("No dest folder found for [" + message.folder.name + "] " + message.subject + " [" + message.headerMessageId + "]");
              report_data.dest_folder_not_found_messages[message.headerMessageId] = {}
              report_data.dest_folder_not_found_messages[message.headerMessageId].headerMessageId = message.headerMessageId;
              report_data.dest_folder_not_found_messages[message.headerMessageId].relmessage_folder = related_message.folder.name;
              report_data.dest_folder_not_found_messages[message.headerMessageId].subject = message.subject;
              report_data.dest_folder_not_found_messages[message.headerMessageId].date = message.date;
            }
           }else{ // related message not found
            tot_related_msg_not_found++;
            this.logger.log("No related message found for [" + message.folder.name + "] " + message.subject + " [" + message.headerMessageId + "]");
            report_data.related_msg_not_found_messages[message.headerMessageId] = {}
            report_data.related_msg_not_found_messages[message.headerMessageId].headerMessageId = message.headerMessageId;
            report_data.related_msg_not_found_messages[message.headerMessageId].subject = message.subject;
            report_data.related_msg_not_found_messages[message.headerMessageId].date = message.date;
           }
        }
        // TODO improve messages with single, plural and 0 messages
        samUtils.showNotification("Sent Auto Move", "Operation completed\n"  + tot_messages + " messages analyzed\n" + tot_moved + " moved\n" + tot_dest_not_found + " not moved: destination folder not found" + (tot_related_msg_not_found > 0 ? "\n" + tot_related_msg_not_found + " related messages not found" : ""));
        this.logger.log("Operation completed: " + tot_messages + " messages analyzed, " + tot_moved + " messages moved, " + tot_dest_not_found + " messages not moved: dest folder not found." + (tot_related_msg_not_found > 0 ? "\n" + tot_related_msg_not_found + " related messages not found" : ""));
        
        let report_id = account_id + "_" +  (new Date()).toLocaleString(undefined,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).replace(/[-:.,// ]/g, '') + "_" + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        report_data.tot_messages = tot_messages;
        report_data.tot_moved = tot_moved;
        report_data.tot_dest_not_found = tot_dest_not_found;
        report_data.tot_related_msg_not_found = tot_related_msg_not_found;

        let stop_time = performance.now();
        report_data.elapsed_time = stop_time - start_time;

        await samReport.saveReportData(report_data, report_id);
        if(tot_moved >= this.min_moves_to_report){
          samReport.openReportTab(report_id);
        }
    }


    // this method finds the message related to the one passed to it
    async findRelatedMessage(message, account_id = 0){

      let fullMsg = await messenger.messages.getFull(message.id);
      // console.log(">>>>>>>>>>>> fullMsg: " + JSON.stringify(fullMsg.headers));
      let inReplyToHeaders = fullMsg.headers['in-reply-to'];
      this.logger.log("inReplyToHeaders: " + inReplyToHeaders);

      // inReplyToHeaders = undefined;
      if(inReplyToHeaders != undefined){
        let query_params = {
          headerMessageId: Array.isArray(inReplyToHeaders) ? inReplyToHeaders[0].replace(/^<|>$/g, '') : inReplyToHeaders.replace(/^<|>$/g, ''),
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

        for await (let found_msg of found_messages) {
          this.logger.log("[in-reply-to] Related found_msg.subject: [" + found_msg.folder.name + "] " + found_msg.subject + " [" + message.headerMessageId + "]");
          // get only the first one at the moment
          return found_msg;
        }
      }

      // We found nothing, check the header "references" see https://www.jwz.org/doc/threading.html
      let referencesHeaders = fullMsg.headers['references'];
      // console.log(">>>>>> fullMsg.headers: " + JSON.stringify(fullMsg.headers));
      this.logger.log("referencesHeaders: " + referencesHeaders);
      let referenceIDs = this.extractReferencesIDs(referencesHeaders);

      // referencesHeaders = undefined;
      if(referencesHeaders != undefined){
        for (let referenceID of referenceIDs) {
          this.logger.log("referenceID: " + referenceID);
          // Construct query_params for each value
          let query_params = {
            headerMessageId: referenceID,
          };

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

          for await (let found_msg of found_messages) {
            this.logger.log("[References] Related found_msg.subject: [" + found_msg.folder.name + "] " + found_msg.subject + " [" + message.headerMessageId + "]");
            // get only the first one at the moment
            return found_msg;
          }
        }
      }

      // we found nothing, try "Thread-Index": see https://managing.blue/2007/12/11/trying-to-make-use-of-outlooks-thread-index-header/
      // this is an event invite and response, so the message sent from the account is one-to-one
      let thread_indexHeaders = fullMsg.headers['thread-index'];
      this.logger.log("threadindexHeaders: " + JSON.stringify(thread_indexHeaders));
      //console.log(">>>>>> message: " + JSON.stringify(message));
      if(thread_indexHeaders != undefined){
        thread_indexHeaders = thread_indexHeaders[0].substring(0, 28);
        let query_params = {  // get only messages from the recipient of the current message and sent from the current account
          recipients: message.author,
          author: message.recipients[0],
          subject: samUtils.extractInviteSubject(message.subject),  // this is an invite response
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

        for await (let found_msg of found_messages) {
          let fullFoundMsg = await messenger.messages.getFull(found_msg.id);
          let found_thread_indexHeaders = fullFoundMsg.headers['thread-index'];
          if(found_thread_indexHeaders == undefined) continue;
          found_thread_indexHeaders = found_thread_indexHeaders[0].substring(0, 28);
          if(found_thread_indexHeaders == thread_indexHeaders){
            this.logger.log("[thread-index] Related found_msg.subject: [" + found_msg.folder.name + "] " + found_msg.subject + " [" + message.headerMessageId + "]");
            // get only the first one at the moment
            return found_msg;
          }
        }
      }


      // we found nothing, so return false
      return false;
    }

    extractReferencesIDs(references){
      // Regular expression to match text inside <>
      const regex = /<([^>]+)>/g;

      // Array to store extracted values
      const extractedValues = [];

      // Use regex to find matches and add them to the array
      let match;
      while ((match = regex.exec(references)) !== null) {
        extractedValues.push(match[1]);
      }

      return extractedValues;
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