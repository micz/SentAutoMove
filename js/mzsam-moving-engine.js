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
  use_also_thread_index = false;
  reverse_reply_search = false;
  dest_folder_type = '';
  dest_folder_prefix = '';
  dest_folder_ok_same_folder_with_prefix = true;
  ignore_archives_folders = true;
  min_moves_to_open_report_tab = 0;
  max_messages_moved = 0;
  pause_between_messages = 200;
  pause_every_10_messages = 1000;
  force_stop = false;

  constructor(params){
    // console.log(">>>>>>>>>> movingEngine constructor samStore.do_debug: " + samStore.do_debug);
    this.logger = new samLogger("mzsam-moving-engine", samStore.do_debug);
    samPrefs.logger = this.logger;
    samReport.logger = this.logger;
    this.logger.log("Constructor params: " + JSON.stringify(params));
    this.do_only_same_account = params.do_only_same_account;
    this.do_only_sent = params.do_only_sent;
    this.dest_folder_type = params.dest_folder_type;
    this.dest_folder_prefix = params.dest_folder_prefix;
    this.dest_folder_ok_same_folder_with_prefix = params.dest_folder_ok_same_folder_with_prefix;
    this.ignore_archives_folders = params.ignore_archives_folders;
    this.min_moves_to_open_report_tab = params.min_moves_to_open_report_tab;
    this.max_messages_moved = params.max_messages_moved;
    this.use_also_thread_index = params.use_also_thread_index;
    this.reverse_reply_search = params.reverse_reply_search;
    this.pause_between_messages = params.pause_between_messages;
    this.pause_every_10_messages = params.pause_every_10_messages;
  }


  async checkFolder(folder){
    let query_params = {}

    query_params = {
      folderId: folder.id,
    }
    
    this.logger.log("Checking folder [" + folder.name + "]");
    await this.moveMessages(messenger.messages.query(query_params), samUtils.getFolderAccountId(folder), query_params);
  }


  async moveMessages(message_list, account_id = -1, query_params = null){
      this.logger.log("Start moving messages...");
      samUtils.setPopupStarting();
      let start_time = performance.now();
      //set debug option
      this.logger.changeDebug(samStore.do_debug);

      let operation_aborted = false;

      let report_data = {};
      report_data.report_date = new Date();
      let tot_messages = 0;
      let tot_moved = 0;
      let tot_dest_not_found = 0;
      let tot_related_msg_not_found = 0;

      let account_emails = null;
      let account_emails_map = {};

      if(account_id != -1){
        account_emails = await samUtils.getAccountEmails(account_id);
      }

      let messages = this.getMessages(message_list);

      let folder_string = browser.i18n.getMessage("executedFromSelection");
      if(query_params !== null){
        folder_string = (await messenger.folders.get(query_params.folderId)).name;
      }

      report_data.current_folder = folder_string;
      report_data.current_account_id = account_id;
      report_data.moved_messages = {};
      report_data.dest_folder_not_found_messages = {};
      report_data.related_msg_not_found_messages = {};

      for await (let message of messages) {
        samUtils.setPopupRunning({folder: folder_string, tot_messages: tot_messages, tot_moved: tot_moved, tot_dest_not_found: tot_dest_not_found, tot_related_msg_not_found: tot_related_msg_not_found});
        if((this.max_messages_moved > 0) && (tot_moved >= this.max_messages_moved)){
          this.logger.log("Max number of messages to move reached, stopping...");
          break;
        }
        if(this.force_stop){
          this.logger.log("Process stopped by the user, stopping...");
          this.force_stop = false;
          break;
        }
        let curr_account_id = account_id;
        if(account_id == -1){
          curr_account_id = samUtils.getFolderAccountId(message.folder);
        }
        // Check if we are online in case of IMAP account
        let curr_account = await browser.accounts.get(curr_account_id, false);
        // If it's an IMAP Account and we are offline it's better to stop
        // console.log(">>>>>>>>>> curr_account: " + JSON.stringify(curr_account));
        // console.log(">>>>>>>>>> samUtils.isAccountIMAP(curr_account): " + samUtils.isAccountIMAP(curr_account));
        // console.log(">>>>>>>> samStore.getOnline(): " + await samStore.getOnline());
        if(samUtils.isAccountIMAP(curr_account) && !await samStore.getOnline()) {
          this.logger.log("Thunderbird is offline, stopping...");
          samUtils.setPopupError();
          samUtils.showNotification(browser.i18n.getMessage("Warning") + "!", browser.i18n.getMessage("ThunderbirdGoneOffline"));
          operation_aborted = true;
          break;
        }
        // console.log(">>>>>>>>>> this.do_only_sent: " + this.do_only_sent);
        if(this.do_only_sent){
          const match_author = message.author.match(samUtils.regexEmail);
          if (match_author) {
            const key_author = match_author[0].toLowerCase();
            // console.log(">>>>>>>>>> key_author: " + key_author);
            // console.log(">>>>>>>>>> account_emails: " + JSON.stringify(account_emails));
            if(account_id == -1){
              let curr_acc_id = samUtils.getFolderAccountId(message.folder);
              if(!(curr_acc_id in account_emails_map)){
                account_emails_map[curr_acc_id] = await samUtils.getAccountEmails(curr_acc_id);
              }
              account_emails = account_emails_map[curr_acc_id];
            }
            if(!account_emails.includes(key_author)) {
              this.logger.log("Account is not the author, skipping message [" + message.subject + "] [" + message.headerMessageId + "]");
              continue;
            }
          }
        }
          tot_messages++;
          //console.log(">>>>>>>>>>>> Original message.subject: [" + message.folder.name + "] " + message.subject);
          let related_message = await this.findRelatedMessage(message, curr_account_id);
          if(related_message !== false){
          let dest_folder = false;
          switch(this.dest_folder_type){
            case 'subfolder':
              dest_folder = await this.getDestSubFolder(related_message,this.dest_folder_prefix,this.dest_folder_ok_same_folder_with_prefix);
              break;
            case 'same_folder':
              dest_folder = await this.getDestSameFolder(related_message);
              break;
          }
          if(dest_folder !== false){
            // console.log(">>>>>>>>>>>> dest_folder: " + JSON.stringify(dest_folder));
            // ================================ The following line has to be commented out for testing ================================
            await this.doMessagesMove([message.id], dest_folder);
            // ========================================================================================================================
            tot_moved++;
            this.logger.log("Moving [" + message.subject + "] to [" + dest_folder.name + "] [" + message.headerMessageId + "] [" + samUtils.formatDateString(message.date) + "]");
            this.logger.log("Messages moved [" + tot_moved + "]");
            report_data.moved_messages[message.headerMessageId] = {}
            report_data.moved_messages[message.headerMessageId].headerMessageId = message.headerMessageId;
            report_data.moved_messages[message.headerMessageId].dest_folder = dest_folder.name;
            report_data.moved_messages[message.headerMessageId].dest_folder_id = dest_folder.id;
            report_data.moved_messages[message.headerMessageId].subject = message.subject;
            report_data.moved_messages[message.headerMessageId].date = message.date;
            // Pause after moving a message
            if(this.pause_between_messages > 0){
              this.logger.log("Pausing " + this.pause_between_messages + "ms after moving a message...");
              await new Promise(resolve => setTimeout(resolve, this.pause_between_messages));
              this.logger.log("Resuming...");
            }
            // Pause after 10 messages
            if(this.pause_every_10_messages > 0 && (tot_moved % 10 == 0)){
              this.logger.log("Pausing " + this.pause_every_10_messages + "ms after moving 10 messages...");
              await new Promise(resolve => setTimeout(resolve, this.pause_every_10_messages));
              this.logger.log("Resuming...");
            }
          }else{
            tot_dest_not_found++;
            this.logger.log("No dest folder found for [" + message.folder.name + "] " + message.subject + " [" + message.headerMessageId + "]");
            report_data.dest_folder_not_found_messages[message.headerMessageId] = {}
            report_data.dest_folder_not_found_messages[message.headerMessageId].headerMessageId = message.headerMessageId;
            report_data.dest_folder_not_found_messages[message.headerMessageId].relmessage_folder = related_message.folder.name;
            report_data.dest_folder_not_found_messages[message.headerMessageId].relmessage_folder_id = related_message.folder.id;
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
      if(!operation_aborted) samUtils.setPopupCompleted();
      const notificationTitle = browser.i18n.getMessage("sentAutoMoveTitle");
      const operationCompletedText = browser.i18n.getMessage("operationCompleted");

      const messagesAnalyzedText = samUtils.getLocalizedMessage("messagesAnalyzed", tot_messages);
      const messagesMovedText = samUtils.getLocalizedMessage("messagesMoved", tot_moved);
      const messagesNotMovedText = samUtils.getLocalizedMessage("messagesNotMoved", tot_dest_not_found);
      const relatedMessagesNotFoundText = tot_related_msg_not_found > 0 ? samUtils.getLocalizedMessage("relatedMessagesNotFound", tot_related_msg_not_found) : '';

      const notificationMessage = `${operationCompletedText}\n${messagesAnalyzedText}\n${messagesMovedText}\n${messagesNotMovedText}${relatedMessagesNotFoundText ? '\n' + relatedMessagesNotFoundText : ''}`;
      samUtils.showNotification(notificationTitle, notificationMessage);

      this.logger.log("Operation completed: " + tot_messages + " messages analyzed, " + tot_moved + " messages moved, " + tot_dest_not_found + " messages not moved: dest folder not found." + (tot_related_msg_not_found > 0 ? "\n" + tot_related_msg_not_found + " related messages not found" : ""));
      
      let report_id = (account_id != -1 ? account_id : '_from_selection_' ) + "_" +  (new Date()).toLocaleString(undefined,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).replace(/[-:.,// ]/g, '') + "_" + Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      report_data.report_id = report_id;
      report_data.tot_messages = tot_messages;
      report_data.tot_moved = tot_moved;
      report_data.tot_dest_not_found = tot_dest_not_found;
      report_data.tot_related_msg_not_found = tot_related_msg_not_found;

      let stop_time = performance.now();
      report_data.elapsed_time = stop_time - start_time;

      await samReport.saveReportData(report_data, report_id);
      if(tot_moved >= this.min_moves_to_open_report_tab){
        samReport.openReportTab(report_id);
      }
  }

  async doMessagesMove(messageIds, dest_folder){
    this.logger.log("Start moving messages: " + JSON.stringify(messageIds));
    this.logger.log("Destination folder: " + JSON.stringify(dest_folder));
    await messenger.messages.move(messageIds, samUtils.getParameter(dest_folder)).catch((err) => {
      this.logger.error("Error moving message [" + message.subject + "] [" + message.headerMessageId + "]: " + err);
    });
  }

  // this method finds the message related to the one passed to it
  async findRelatedMessage(message, account_id = 0){

    this.logger.log("calling findRelatedMessage method for message [" + message.headerMessageId + "] [" + message.subject + "] [" + samUtils.formatDateString(message.date) + "]");
    let fullMsg = null
    try{
      fullMsg = await messenger.messages.getFull(message.id);
    }catch(e){
      this.logger.log("Error getting the full original message, stopping: " + e);
      return false;
    }
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
        //query_params.accountId = samUtils.getFolderAccountId(message.folder);
        query_params.folderId = await samUtils.getAccountFoldersIds(samUtils.getFolderAccountId(message.folder), this.ignore_archives_folders);
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
          //query_params.accountId = samUtils.getFolderAccountId(message.folder);
          query_params.folderId = await samUtils.getAccountFoldersIds(samUtils.getFolderAccountId(message.folder), this.ignore_archives_folders);
        }

        if(found_messages == null) found_messages = this.getMessages(messenger.messages.query(query_params));

        for await (let found_msg of found_messages) {
          this.logger.log("[References] Related found_msg.subject: [" + found_msg.folder.name + "] " + found_msg.subject + " [" + message.headerMessageId + "]");
          // get only the first one at the moment
          return found_msg;
        }
      }
    }

    // We found nothing, try also:
    //                    - "Thread-Index": see https://managing.blue/2007/12/11/trying-to-make-use-of-outlooks-thread-index-header/
    //                    - If there is a reply to this message store somewhere
    // This is an event invite and response, so the message sent from the account is one-to-one
    if((this.use_also_thread_index) || (this.reverse_reply_search)){
      let thread_indexHeaders = undefined;
      let use_thread_index = false;
      if(this.use_also_thread_index){
        thread_indexHeaders = fullMsg.headers['thread-index'];
        this.logger.log("thread_indexHeaders: " + JSON.stringify(thread_indexHeaders));
        //console.log(">>>>>> message: " + JSON.stringify(message));
        if(thread_indexHeaders != undefined){
          thread_indexHeaders = thread_indexHeaders[0].substring(0, 28);
          this.logger.log("thread_indexHeaders final: " + JSON.stringify(thread_indexHeaders));
          use_thread_index = true;
        }
      }
      
      //console.log(">>>>>> message: " + JSON.stringify(message));
      if(use_thread_index || this.reverse_reply_search){
        let recipients_list = message.recipients.concat(message.ccList);        
        for (let recipient of recipients_list) {
          let query_params = {  // get only messages from the recipient of the current message and sent from the current account
            recipients: message.author,
            author: recipient,
            subject: samUtils.extractInviteSubject(message.subject),  // this is an invite response
          }

          let found_messages = null;
          //only from this account
          if(this.do_only_same_account){
            //query_params.accountId = samUtils.getFolderAccountId(message.folder);
            query_params.folderId = await samUtils.getAccountFoldersIds(samUtils.getFolderAccountId(message.folder), this.ignore_archives_folders);
          }

          if(found_messages == null) found_messages = this.getMessages(messenger.messages.query(query_params));
          this.logger.log("query_params: " + JSON.stringify(query_params));

          for await (let found_msg of found_messages) {
            // console.log(">>>>>>>>>> 1 use_thread_index: " + use_thread_index);
            let fullFoundMsg = null;
            try{
              fullFoundMsg = await messenger.messages.getFull(found_msg.id);
            }catch(e){
              this.logger.log("Error getting the full message when searching for related messages, skipping: " + e);
              continue;
            }
            // console.log(">>>>>>>>>>>>>> fullFoundMsg.headers: " + JSON.stringify(fullFoundMsg.headers));
            if(this.reverse_reply_search){
              this.logger.log("Doing reverse_reply_search...");
              // console.log(">>>>>>>>>>>>>> fullFoundMsg.headers['in-reply-to']: " + JSON.stringify(fullFoundMsg.headers['in-reply-to']));
              // console.log(">>>>>>>>>>>>>> message.headerMessageId: " + JSON.stringify(message.headerMessageId));
              if((fullFoundMsg.headers['in-reply-to'] != undefined) && (fullFoundMsg.headers['in-reply-to'].some(replyToId => {
                  const cleanReplyToId = replyToId.replace(/[<>]/g,'');
                  return cleanReplyToId === message.headerMessageId;
                })))
                  {
                this.logger.log("[reverse_reply_search] Related found_msg.subject: [" + found_msg.folder.name + "] " + found_msg.subject + " [" + message.headerMessageId + "]");
                // get only the first one at the moment
                return found_msg;
              }
            }
            // console.log(">>>>>>>>>> use_thread_index: " + use_thread_index);
            if(use_thread_index){
              this.logger.log("Searching for thread-index...");
              let found_thread_indexHeaders = fullFoundMsg.headers['thread-index'];
              if(found_thread_indexHeaders == undefined) continue;
              found_thread_indexHeaders = found_thread_indexHeaders[0].substring(0, 28);
              // console.log(">>>>>>>>>>> found_thread_indexHeaders: " + found_thread_indexHeaders);
              // console.log(">>>>>>>>>>> thread_indexHeaders: " + thread_indexHeaders);
              if(found_thread_indexHeaders == thread_indexHeaders){
                this.logger.log("[thread-index] Related found_msg.subject: [" + found_msg.folder.name + "] " + found_msg.subject + " [" + message.headerMessageId + "]");
                // get only the first one at the moment
                return found_msg;
              }
            }
          }
        }
      }
    }

    this.logger.log("[findRelatedMessage] No related message found.");
    // we found nothing, so return false
    return false;
  }

  doStop(){
    this.force_stop = true;
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

  async getDestSubFolder(message, prefix, same_folder_with_prefix){
    let currentFolder = message.folder;
    let subFolders = null;

    subFolders = await messenger.folders.getSubFolders(samUtils.getParameter(currentFolder), true);

    for (let subFolder of subFolders) {
      if (subFolder.name.startsWith(prefix)) {
          return subFolder;
      }
    }

    if((same_folder_with_prefix) && (currentFolder.name.startsWith(prefix))){
      return currentFolder;
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
  try{
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
      if(this.ignore_archives_folders && folder.type == "archives") {
        continue;
      }
      yield* this.processFolderAndSubfolders(folder, queryInfo, account_id);
    }
  } catch(e) {
    this.logger.error("getAccountMessages error: " + e);
  }
  }

  async *processFolderAndSubfolders(folder, queryInfo, account_id) {
    try{
      //console.log(`>>>>>>>> processFolderAndSubfolders Listing messages for folder: ${folder.name}, path: ${folder.path}`);
      queryInfo.folder = folder;
      // console.log(">>>>>>>>>> processFolderAndSubfolders queryInfo: " + JSON.stringify(queryInfo));
      yield* this.getMessages(browser.messages.query(queryInfo));

      let subfolders = await browser.folders.getSubFolders(folder);
      for (let subfolder of subfolders) {
          yield* this.processFolderAndSubfolders(subfolder, queryInfo, account_id);
      }
    } catch(e) {
      this.logger.error("processFolderAndSubfolders error: " + e);
    }
  }

}