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

    samStore.do_debug = await samPrefs.getPref("do_debug");
    samLog = new samLogger("mzsam-popup", samStore.do_debug);
    samPrefs.logger = new samLogger("mzsam-options", samStore.do_debug);

    document.getElementById("miczProceed").addEventListener("click", doProceed);
    document.getElementById("miczStop").addEventListener("click", doStop);

    if(!await samStore.getIsRunning()){
        await browser.runtime.sendMessage({ command: 'sam_save_folder_info' });

        browser.browserAction.setIcon({path: "../images/icon.png"});
        let prefs = await samPrefs.getPrefs(["warn_before_run","_internal__ask_empty_prefix_done","dest_folder_prefix","do_only_sent_folders"]);

        let folder_info = await samUtils.getCurrentFolderInfo();
        let curr_account = await browser.accounts.get(folder_info.accountId, false);

        // If it's an IMAP Account and we are offline it's better do nothing
        if(samUtils.isAccountIMAP(curr_account) && !samUtils.isThunderbirdOnline()) {
            showThunderbirdOfflineDiv();
            i18n.updateDocument();
            return;
        }

        // Check if only "sent" folder, are we in a "sent" folder?
        if(prefs.do_only_sent_folders){
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
    if((!"data" in message) || (message.data === undefined) || (message.data === null)) {
        document.getElementById("miczMessage").innerText = message.message;
        hideStopButton();
    }else{
        if(message.type== "running"){
            const table = document.createElement("table");
            table.className = "live-counter";
            const tr = document.createElement("tr");
            const td1 = document.createElement("td");
            const td2 = document.createElement("td");
            td1.className = "live-counter-msg";
            td1.textContent = message.message;
            const br1 = document.createElement("br");
            const br2 = document.createElement("br");
            const br3 = document.createElement("br");
            td2.appendChild(document.createTextNode(browser.i18n.getMessage("Messages") + ": " + message.data.tot_messages));
            td2.appendChild(br1);
            td2.appendChild(document.createTextNode(browser.i18n.getMessage("Moved") + ": " + message.data.tot_moved));
            td2.appendChild(br2);
            td2.appendChild(document.createTextNode(browser.i18n.getMessage("NoDestinationFolder") + ": " + message.data.tot_dest_not_found));
            td2.appendChild(br3);
            td2.appendChild(document.createTextNode(browser.i18n.getMessage("NoRelatedMessage") + ": " + message.data.tot_related_msg_not_found));
            tr.appendChild(td1);
            tr.appendChild(td2);
            table.appendChild(tr);
            document.getElementById("miczMessage").innerHTML = "";
            document.getElementById("miczMessage").appendChild(table);
            document.getElementById("currFolder").innerText = browser.i18n.getMessage("Folder") + ": " + message.data.folder;
            showStopButton();
        }
    }
    samLog.log("Setting popup message: " + JSON.stringify(message));
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

function showThunderbirdOfflineDiv(){
    document.getElementById("TBOfflineWarning").style.display = "block";
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
    setMessage({message: "SAM: " + browser.i18n.getMessage("Idle") + "!", type: "idle"});
    browser.browserAction.setIcon({path: "images/icon.png"});
}

async function _proceed(){
    browser.runtime.sendMessage({ command: 'sam_run' });
    samUtils.setPopupStarting();
    setMessage(await samUtils.getPopupMessage());
    showMessageDiv();
    setContinuousMessageUpdate();
    showStopButton();
}

function doProceed() {
    hideAskUserDiv();
    _proceed();
    if(ask_empty_prefix){
        samPrefs.setPref("_internal__ask_empty_prefix_done", true);
    }
}

function doStop() {
    browser.runtime.sendMessage({ command: 'sam_stop' });
    stoppingStopButton();
}

function showStopButton() {
    document.getElementById("miczStop").style.display = "flex";
}

function stoppingStopButton() {
    document.getElementById("miczStop").innerText = browser.i18n.getMessage("Stopping") + "...";
}

function hideStopButton() {
    document.getElementById("miczStop").style.display = "none";
}
