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




export const samReport = {

    logger: console,

    async saveReportData(data, data_id){
        let obj = {};
        obj[data_id] = data;
        await browser.storage.session.set(obj);
    },

    async loadReportData(data_id){
        return await browser.storage.session.get(data_id);
    },

    openReportTab(data_id){
        browser.tabs.create({active: false, url: browser.runtime.getURL('report/mzsam-report.html') + '?data_id=' + data_id});
    },

}