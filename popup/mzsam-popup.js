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
import { samUtils } from "../js/mzsam-utils.js";

let samLog = null;
let updateInterval = null;
let ask_empty_prefix = false;

document.addEventListener('DOMContentLoaded', async () => {
    browser.runtime.sendMessage({ command: 'sam_save_folder_info' });

    samStore.do_debug = await samPrefs.getPref("do_debug");
    samLog = new samLogger("mzsam-popup", samStore.do_debug);
    samPrefs.logger = new samLogger("mzsam-options", samStore.do_debug);

    document.getElementById("miczProceed").addEventListener("click", doProceed);

    if(!await samStore.getSessionData('is_running')){
        browser.browserAction.setIcon({path: "../images/icon.png"});
        let prefs = await samPrefs.getPrefs(["warn_before_run","_internal__ask_empty_prefix_done","dest_folder_prefix","do_only_sent_folders"]);

        // Check if only "sent" folder, are we in a "sent" folder?
        if(prefs.do_only_sent_folders){
            let folder_info = await samUtils.getCurrentFolderInfo();
            if(!["sent"].includes(folder_info.type)) {
                showFolderNotSentWarningDiv();
                i18n.updateDocument();
                return;
            }
        }

        let warn_before_run = prefs.warn_before_run;
        ask_empty_prefix = !prefs._internal__ask_empty_prefix_done && (prefs.dest_folder_prefix === "");
        if(warn_before_run || ask_empty_prefix) {
            if(ask_empty_prefix){
                showEmptyPrefixDiv();
            }
            setCurrentFolder();
            showAskUserDiv();
        }else{
            _proceed();
        }
    }else{
        showMessageDiv();
        setContinuousMessageUpdate();
    }
    i18n.updateDocument();

}, { once: true });

function showMessageDiv(){
    document.getElementById("miczMessage").style.display = "flex";
}

function hideMessageDiv(){
    document.getElementById("miczMessage").style.display = "none";
}

function setMessage(message) {
    samLog.log("Setting popup message: " + message);
    document.getElementById("miczMessage").innerText = message;
}

function showAskUserDiv(){
    document.getElementById("miczAskUser").style.display = "block";
}

function hideAskUserDiv(){
    document.getElementById("miczAskUser").style.display = "none";
}

function showEmptyPrefixDiv(){
    document.getElementById("askEmptyPrefix").style.display = "block";
}

function showFolderNotSentWarningDiv(){
    document.getElementById("folderNotSentWarning").style.display = "block";
}

async function setCurrentFolder(){
    let folder_info = await samUtils.getCurrentFolderInfo();
    document.getElementById("current_folder").innerText = folder_info.name;
}

async function setContinuousMessageUpdate() {
    setMessage(await samUtils.getPopupMessage());
    updateInterval = setInterval(async () => {
        setMessage(await samUtils.getPopupMessage());
    }, 2000);
}

function cancelContinousMessageUpdate() {
    clearInterval(updateInterval);
    hideMessageDiv();
    setMessage("SAM: Idle");
    browser.browserAction.setIcon({path: "images/icon.png"});
}

async function _proceed(){
    browser.runtime.sendMessage({ command: 'sam_run' });
    samUtils.setPopupStarting();
    setMessage(await samUtils.getPopupMessage());
    showMessageDiv();
    setContinuousMessageUpdate();
}

function doProceed() {
    hideAskUserDiv();
    _proceed();
    if(ask_empty_prefix){
        samPrefs.setPref("_internal__ask_empty_prefix_done", true);
    }
}
