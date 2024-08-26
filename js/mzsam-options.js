/*
 *  Copyright  Mic  (email: m@micz.it)
 *
 *  This Source Code Form is subject to the terms of the Mozilla Public
 *  License, v. 2.0. If a copy of the MPL was not distributed with this
 *  file, You can obtain one at https://mozilla.org/MPL/2.0/.
 * 
 *  This file is avalable in the original repo: https://github.com/micz/Thunderbird-Addon-Options-Manager
 * 
 */
 
import { prefs_default } from './mzsam-options-default.js';

export const samPrefs = {

  logger: console,

  saveOptions(e) {
    e.preventDefault();
    let options = {};
    let element = e.target;
      switch (element.type) {
        case 'checkbox':
          options[element.id] = element.checked;
          samPrefs.logger.log('Saving option: ' + element.id + ' = ' + element.checked);
          break;
        case 'number':
          options[element.id] = element.valueAsNumber;
          samPrefs.logger.log('Saving option: ' + element.id + ' = ' + element.valueAsNumber);
          break;
        case 'text':
          options[element.id] = element.value.trim();
          samPrefs.logger.log('Saving option: ' + element.id + ' = ' + element.value);
          break;
        default:
          if (element.tagName === 'SELECT') {
            options[element.id] = element.value;
            samPrefs.logger.log('Saving option: ' + element.id + ' = ' + element.value);
          }else{
            samPrefs.logger.log('Unhandled input type:', element.type);
          }
      }
    browser.storage.sync.set(options);
  },

  async setPref(pref_id, value){
    let obj = {};
    obj[pref_id] = value;
    samPrefs.logger.log('Saving option: ' + pref_id + ' = ' + JSON.stringify(value));
    browser.storage.sync.set(obj)
  },

  async getPref(pref_id){
    let obj = {};
    obj[pref_id] = prefs_default[pref_id];
    let prefs = await browser.storage.sync.get(obj)
    samPrefs.logger.log("getPref prefs: " + JSON.stringify(prefs));
    return prefs[pref_id];
  },

  
  async getPrefs(pref_ids){
    let obj = {};
    pref_ids.forEach(pref_id => {
      obj[pref_id] = prefs_default[pref_id];
    });
    let prefs = await browser.storage.sync.get(obj)
    samPrefs.logger.log("getPrefs: " + JSON.stringify(prefs));
    let result = {};
    pref_ids.forEach(pref_id => {
      result[pref_id] = prefs[pref_id];
    });
    return result;
  },


  restoreOptions() {
    function setCurrentChoice(result) {
      samPrefs.logger.log("restoreOptions: " + JSON.stringify(result));
      document.querySelectorAll(".option-input").forEach(element => {
        const defaultValue = prefs_default[element.id];
        switch (element.type) {
          case 'checkbox':
            let default_checkbox_value = defaultValue !== undefined ? defaultValue : false;
            element.checked = result[element.id] !== undefined ? result[element.id] : default_checkbox_value;
            break;
          case 'number':
            let default_number_value = defaultValue !== undefined ? defaultValue : 0;
            element.value = result[element.id] !== undefined ? result[element.id] : default_number_value;
            break;
          case 'text':
            let default_text_value = defaultValue !== undefined ? defaultValue : '';
            element.value = result[element.id] !== undefined ? result[element.id] : default_text_value;
            break;
          default:
          if (element.tagName === 'SELECT') {
            let default_select_value = defaultValue !== undefined ? defaultValue : '';
            element.value = result[element.id] !== undefined ? result[element.id] : default_select_value;
            if (element.value === '') {
              element.selectedIndex = -1;
            }
          }else{
            samPrefs.logger.log('Unhandled input type:', element.type);
          }
        }
      });
    }

    function onError(error) {
      samPrefs.logger.log(`Error: ${error}`);
    }

    let getting = browser.storage.sync.get(prefs_default);
    getting.then(setCurrentChoice, onError);
  }
};
