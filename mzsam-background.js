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

import { movingEngine } from "./js/mzsam-moving-engine.js";
import { samUtils } from "./js/mzsam-utils.js";
import { samStore } from "./js/mzsam-store.js";
import { samPrefs } from "./js/mzsam-options.js";
import { prefs_default } from "./js/mzsam-options-default.js";
import { samLogger } from "./js/mzsam-logger.js";


// messenger.messages.onNewMailReceived.addListener(async (folder, messages) => {
//     console.log("onNewMailReceived folder: ", folder.name);
//     movingEngine.newMailListener(folder, messages);
// },true)

// messenger.compose.onAfterSend.addListener(async (tab, sendInfo) => {
//     console.log("onAfterSend message: ", sendInfo.messages[0].subject);
//     movingEngine.sentMessageListener(sendInfo);
// })

// messenger.messages.onMoved.addListener(async (originalMessages, movedMessages) => {
//     console.log("onMoved message Original: [" + originalMessages.messages[0].folder.name + "] " + originalMessages.messages[0].subject);
//     movingEngine.movedMessagesListener(originalMessages, movedMessages);
// });

samStore.do_debug = await samPrefs.getPref("do_debug");
let samLog = new samLogger("mzsam-background", samStore.do_debug);

let mvEngine  = null;


// browser.browserAction.onClicked.addListener(async () => {
//     let prefs = await samPrefs.getPrefs(Object.keys(prefs_default));
//     samStore.do_debug = prefs.do_debug;

//     let folder = await samUtils.getCurrentTabFolder();
//     if(prefs.do_only_sent_folders && !["sent"].includes(folder.type)) {
//         samUtils.showNotification("Warning!", "This is not a \"sent\" folder!\r\nIf you want to run on any folder, change the preference in the options page.");
//         return;
//     }
//     let params = {};
//     for (let key of Object.keys(prefs)) {
//         params[key] = prefs[key];
//     }

//     let mvEngine = new movingEngine(params);
//     await mvEngine.checkFolder(folder);
//   });

// browser.browserAction.onClicked.addListener(async () => {
//     run();
//   });

messenger.runtime.onMessage.addListener( (message, sender, sendResponse) => {
    // Check what type of message we have received and invoke the appropriate
    // handler function.
    if (message && message.hasOwnProperty("command")){
        switch (message.command) {
            case "sam_run":
                run();
                break;
            case "sam_save_folder_info":
                setCurrentFolderInfo();
                break;
            case 'sam_stop':
                mvEngine.doStop();
                break;
            default:
                break;
        }
    }
});

async function setCurrentFolderInfo() {
    let folder = await samUtils.getCurrentTabFolder();
    samUtils.setCurrentFolderInfo({name: folder.name, id: folder.id, type: folder.type, accountId: folder.accountId});
}

async function run(){
    samLog.log("Starting...");
    samUtils.setPopupStarting();
    samStore.setIsRunning(true);
    let prefs = await samPrefs.getPrefs(Object.keys(prefs_default));
    samStore.do_debug = prefs.do_debug;

    let folder = await samUtils.getCurrentTabFolder();
    let curr_account = await browser.accounts.get(folder.accountId, false);
    // If it's an IMAP Account and we are offline it's better do nothing
    if(samUtils.isAccountIMAP(curr_account) && !samUtils.isThunderbirdOnline()) {
        samUtils.showNotification(browser.i18n.getMessage("Warning") + "!", browser.i18n.getMessage("ThunderbirdOffline"));
        samUtils.setPopupIdle();
        return;
    }
    samStore.setOnline(true);
    if(prefs.do_only_sent_folders && !["sent"].includes(folder.type)) {
        samUtils.showNotification(browser.i18n.getMessage("Warning") + "!", browser.i18n.getMessage("thisIsNotSentFolder"));
        samUtils.setPopupIdle();
        return;
    }
    let params = {};
    for (let key of Object.keys(prefs)) {
        params[key] = prefs[key];
    }

    mvEngine = new movingEngine(params);
    try{
        await mvEngine.checkFolder(folder);
    } catch(e) {
        samStore.setIsRunning(false);
        samLog.error("Error: " + e);    
    }
    samStore.setIsRunning(false);
    samLog.log("Operation completed!");
}


browser.menus.create({
    id: "sam-single-msg",
    title: browser.i18n.getMessage("moveWith") + " SentAutoMove",
    contexts: ["message_list"]
    });

browser.menus.onClicked.addListener( (info, tab) => {
    async function handleMenuClick() {
        samLog.log("Starting...");
        samUtils.setPopupStarting();
        samStore.setIsRunning(true);
        let prefs = await samPrefs.getPrefs(Object.keys(prefs_default));
        samStore.do_debug = prefs.do_debug;

        samLog.log("Using message menu...");

        let folder = await samUtils.getCurrentTabFolder();
        let curr_account = await browser.accounts.get(folder.accountId, false);
        // If it's an IMAP Account and we are offline it's better do nothing
        if(samUtils.isAccountIMAP(curr_account) && !samUtils.isThunderbirdOnline()) {
            samUtils.showNotification(browser.i18n.getMessage("Warning") + "!", browser.i18n.getMessage("ThunderbirdOffline"));
            samUtils.setPopupIdle();
            return;
        }
        samStore.setOnline(true);
        
        let params = {};
        for (let key of Object.keys(prefs)) {
            params[key] = prefs[key];
        }

        mvEngine = new movingEngine(params);
        try{
            await mvEngine.moveMessages(info.selectedMessages);
        } catch(e) {
            samStore.setIsRunning(false);
            samLog.error("Error: " + e);    
        }
        samStore.setIsRunning(false);
        samLog.log("Operation completed!");
        samUtils.setPopupCompleted();
    }

    if (info.menuItemId === "sam-single-msg") {
        handleMenuClick();
    }
});

window.addEventListener("offline", (e) => {
    samStore.setOnline(false);
    samLog.log("Thunderbird offline");
});

window.addEventListener("online", (e) => {
    samStore.setOnline(true);
    samLog.log("Thunderbird online");
});