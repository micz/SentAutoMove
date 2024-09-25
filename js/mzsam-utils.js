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


export const samUtils = {

  regexEmail: /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,

  async isThunderbird128OrGreater(){
      try {
        const info = await browser.runtime.getBrowserInfo();
        const version = info.version;
        return samUtils.compareThunderbirdVersions(version, '128.0') >= 0;
      } catch (error) {
        console.error('[ThunderAI] Error retrieving browser information:', error);
        return false;
      }
    },


  compareThunderbirdVersions(v1, v2) {
      const v1parts = v1.split('.').map(Number);
      const v2parts = v2.split('.').map(Number);
    
      for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
        const v1part = v1parts[i] || 0;
        const v2part = v2parts[i] || 0;
        if (v1part > v2part) return 1;
        if (v1part < v2part) return -1;
      }
      return 0;
  },

  setPopupMessage(message){
    samStore.setSessionData("popupMessage", message);
  },

  async getPopupMessage(){
    return await samStore.getSessionData("popupMessage");
  },

  setPopupIdle(){
    samUtils.setPopupMessage("SAM: Idle");
    browser.browserAction.setIcon({path: "images/icon.png"});
  },

  setPopupStarting(){
    samUtils.setPopupMessage("SAM: Starting...");
    browser.browserAction.setIcon({path: "images/icon-running.png"});
  },

  setPopupRunning(count){
    samUtils.setPopupMessage("SAM: [" + count + "] Running...");
    browser.browserAction.setIcon({path: "images/icon-running.png"});
  },

  setPopupCompleted(){
    samUtils.setPopupMessage("SAM: Completed!");
    browser.browserAction.setIcon({path: "images/icon-completed.png"});
  },

  setPopupError(){
    samUtils.setPopupMessage("SAM: Error!");
    browser.browserAction.setIcon({path: "images/icon-error.png"});
  },

  setCurrentFolderInfo(folder_info){
    samStore.setSessionData("currentFolder", folder_info);
  },

  async getCurrentFolderInfo(){
    return await samStore.getSessionData("currentFolder");
  },

  async showNotification(title, message, dismissTime = 20000) {
    let notificationID = await browser.notifications.create(null,{
        "type": "basic",
        "title": title,
        "iconUrl": browser.runtime.getURL("images/icon.png"),
        "message": message
    });

    if(dismissTime > 0) {
      setTimeout(() => {
        browser.notifications.clear(notificationID);
      }, dismissTime);
    }
  },

  // Function to get the folder associated with the current tab
  async getCurrentTabFolder() {
    // Get all currently open tabs
    let tabs = await browser.mailTabs.query({ active: true, currentWindow: true });
    
    // Check if there's an active tab
    if (tabs.length > 0) {
      let currentTab = tabs[0];

      // Get the accountId and folder of the open tab
      let folder = currentTab.displayedFolder;
      //let accountId = folder.accountId;

      // console.log("Account ID:", accountId);
      // console.log("Folder:", folder);

      return folder;
    } else {
      console.log("No active tab found.");
      return null;
    }
  },

  async getAccountEmails(account_id = 0) {
    let accounts = await browser.accounts.list();
    let account_emails = [];

    if(account_id == 0) {
      for (let account of accounts) {
          for (let identity of account.identities) {
              account_emails.push(identity.email.toLowerCase());
          }
      }
    }else{
      for (let account of accounts) {
        if(account.id == account_id) {
          for (let identity of account.identities) {
            account_emails.push(identity.email.toLowerCase());
          }
        }
      }
    }

    return account_emails;
  },

  async getAccountName(account_id) {
    let account = await browser.accounts.get(account_id,false);
    return account.name;
  },

  // async getAccountFoldersIds(account_id, ignore_archive_folders = true) {    // only TB128+
  //   let output = [];

  //   let folders = await browser.folders.getSubFolders(account_id);

  //   console.log(">>>>>>>>>> getAccountFoldersIds folders: " + JSON.stringify(folders));

  //   for (let folder of folders) {
  //     if(["trash", "templates", "drafts", "junk", "outbox"].includes(folder.type)) continue;
  //     if(ignore_archive_folders && folder.type == "archive") {
  //       continue;
  //     }
  //     if(!output.includes(folder.id)) {
  //       output.push(folder.id);
  //       //console.log(">>>>>>>>>>> Folder ID:", folder.id);
  //     }
  //   }

  //   return output;
  // },


  async getAccountFoldersIds(account_id, ignore_archive_folders = true) {
    let output = [];

    async function exploreFolders(folders) {
        for (let folder of folders) {
            if (["trash", "templates", "drafts", "junk", "outbox"].includes(folder.type)) continue;
            if (ignore_archive_folders && folder.type == "archive") {
                continue;
            }
            if (!output.includes(folder.id)) {
                output.push(folder.id);
            }

            // Recursively explore subfolders
            if (folder.subFolders && folder.subFolders.length > 0) {
                await exploreFolders(folder.subFolders);
            }
        }
    }

    let folders = await browser.folders.getSubFolders(account_id);

    //console.log(">>>>>>>>>> getAccountFoldersIds folders: " + JSON.stringify(folders));

    await exploreFolders(folders);

    return output;
},


  getFolderAccountId(folder) {
    return folder.accountId;
  },

  isThunderbirdOnline(){
    return navigator.onLine;
  },

  isAccountIMAP(account) {
    return account.type == "imap";
  },

  getParameter(param){
    if(samStore.istb128orgreater){
      return param.id;
    }else{
      return param;
    }
  },

  extractInviteSubject(inputString) {
    // Controlla se la stringa contiene ':'
    if (inputString.includes(':')) {
      // Estrae la parte della stringa dopo i due punti e rimuove gli spazi in eccesso
      return inputString.split(':')[1].trim();
    } else {
      // Restituisce la stringa originale se ':' non è presente
      return inputString;
    }
  },

  convertFromMilliseconds(milliseconds) {
    const hours = Math.floor(milliseconds / 3600000);
    const minutes = Math.floor((milliseconds % 3600000) / 60000);
    const seconds = Math.floor((milliseconds % 60000) / 1000);
    //const remainingMilliseconds = milliseconds % 1000;
    
    let result = '';

    if (hours !== 0) {
        result += hours + 'h ';
    }

    if (minutes !== 0) {
        result += minutes + 'm ';
    }

    if (seconds !== 0) {
        result += seconds + 's ';
    }

    // if (remainingMilliseconds !== 0) {
    //     result += remainingMilliseconds + 'ms';
    // }

    if(result == '') {
        result = '0s';
    }

    return result.trim();
  },

  formatDateString(date, locale = undefined) {
    // Format the date part
    const formattedDate = date.toLocaleDateString(locale, {
      weekday: 'long',  // Full name of the day (e.g., "martedì")
      day: 'numeric',   // Day of the month (e.g., "3")
      month: 'long',    // Full name of the month (e.g., "settembre")
      year: 'numeric'   // Four-digit year (e.g., "2024")
    });
  
    // Format the time part
    const formattedTime = date.toLocaleTimeString(locale, {
      hour: '2-digit',   // Two-digit hour (e.g., "14")
      minute: '2-digit', // Two-digit minute (e.g., "54")
      second: '2-digit', // Two-digit second (e.g., "09")
      hour12: false      // Use 24-hour time format
    });
  
    // Combine date and time
    return `${formattedDate} - ${formattedTime}`;
  },

  formatDateString_Short(date, locale = undefined) {
    // Format the date part
    const formattedDate = date.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
  
    // Format the time part
    const formattedTime = date.toLocaleTimeString(locale, {
      hour: '2-digit',   // Two-digit hour (e.g., "14")
      minute: '2-digit', // Two-digit minute (e.g., "54")
      hour12: false      // Use 24-hour time format
    });
  
    // Combine date and time
    return `${formattedTime} ${formattedDate}`;
  },

  getLocalizedMessage(key, count) {
    const messageKey = count === 1 ? key : `${key}_plural`;
    return browser.i18n.getMessage(messageKey, [count.toString()]);
  },

}