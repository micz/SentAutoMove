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

document.addEventListener('DOMContentLoaded', async () => {
    samStore.do_debug = await samPrefs.getPref("do_debug");
    samPrefs.logger = new samLogger("mzsam-options", samStore.do_debug);
    samPrefs.restoreOptions();
    i18n.updateDocument();
    document.querySelectorAll(".option-input").forEach(element => {
      element.addEventListener("change", samPrefs.saveOptions);
    });
    showDestFolderOptions();
    let destfoldertype_select = document.getElementById("dest_folder_type");
    destfoldertype_select.addEventListener("change", showDestFolderOptions);
  }, { once: true });
  
  function showDestFolderOptions(){
    let destfoldertype_select = document.getElementById("dest_folder_type");
    let show_prefix = (destfoldertype_select.value === "subfolder") ? "table-row" : "none";
    
    document.querySelectorAll(".dest_folder_type_subfolder").forEach(element => {
      element.style.display = show_prefix;
    });
  }