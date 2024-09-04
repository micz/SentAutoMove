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

document.addEventListener('DOMContentLoaded', async () => {
    samStore.do_debug = await samPrefs.getPref("do_debug");
    samLog = new samLogger("mzsam-popup", samStore.do_debug);
    samPrefs.logger = new samLogger("mzsam-options", samStore.do_debug);

    if(!await samStore.getSessionData('is_running')){
        let warn_before_run = await samPrefs.getPref("warn_before_run");
        if(warn_before_run) {
            // TODO
        }else{
            samUtils.setPopupStarting();
            setMessage(await samUtils.getPopupMessage());
            browser.runtime.sendMessage({ command: 'sam_run' });
            setContinuousMessageUpdate();
        }
    }else{
        setContinuousMessageUpdate();
    }

}, { once: true });


function setMessage(message) {
    samLog.log("Setting popup message: " + message);
    document.getElementById("miczMessage").innerText = message;
}

async function setContinuousMessageUpdate() {
    setMessage(await samUtils.getPopupMessage());
    updateInterval = setInterval(async () => {
        setMessage(await samUtils.getPopupMessage());
    }, 2000);
}

function cancelContinuousMessageUpdate() {
    clearInterval(updateInterval);
}