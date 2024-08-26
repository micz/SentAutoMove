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


  // Function to get the folder associated with the current tab
  async getCurrentTabFolder() {
    // Get all currently open tabs
    let tabs = await browser.mailTabs.query({ active: true, currentWindow: true });
    
    // Check if there's an active tab
    if (tabs.length > 0) {
      let currentTab = tabs[0];

      // Get the accountId and folder of the open tab
      let folder = currentTab.displayedFolder;
      let accountId = folder.accountId;


      console.log("Account ID:", accountId);
      console.log("Folder:", folder);

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

  getParameter(param){
    if(samStore.istb128orgreater){
      return param.id;
    }else{
      return param;
    }
  },

  showNotification(title, message) {
    browser.notifications.create(null,{
        "type": "basic",
        "title": title,
        //"iconUrl": browser.runtime.getURL("images/icon.png"),
        "message": message
    });
  },

}