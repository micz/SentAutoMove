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
import { samPrefs } from "./options/mzsam-options.js";
import { prefs_default } from "./options/mzsam-options-default.js";
//import { samLogger } from "./js/mzsam-logger.js";

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

samStore.istb128orgreater = await samUtils.isThunderbird128OrGreater();
samStore.do_debug = await samPrefs.getPref("do_debug");
//let samLog = new samLogger("mzsam-background.js");


browser.browserAction.onClicked.addListener(async () => {
    let prefs = await samPrefs.getPrefs(Object.keys(prefs_default));

    let folder = await samUtils.getCurrentTabFolder();
    let params = {};
    for (let key of Object.keys(prefs)) {
        params[key] = prefs[key];
    }

    let mvEngine = new movingEngine(params);
    await mvEngine.checkFolder(folder);
  });
