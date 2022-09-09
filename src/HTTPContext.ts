/*
    Copyright (c) 2022 BadAimWeeb
    This file is licensed under the MIT License.
    You should have received the LICENSE file. Alternatively, license text is also
    available at https://opensource.org/licenses/MIT
*/

import { CookieJar } from "tough-cookie";
import fetch from "node-fetch";
import type { RequestInfo, RequestInit } from "node-fetch";

export default class HTTPContext {
    jar = new CookieJar();

    async fetch(target: RequestInfo, init?: RequestInit) {
        let cookie = await this.jar.getCookieString(typeof target === "string" ? target : target.url);

        let request = await fetch(target, {
            ...init,
            redirect: "manual",
            headers: {
                ...init?.headers,
                cookie
            }
        });

        // Automatically save cookies
        let cookies = request.headers.raw()["set-cookie"];
        if (cookies && Array.isArray(cookies)) {
            for (let cookie of cookies) {
                await this.jar.setCookie(cookie, typeof target === "string" ? target : target.url);
            }
        }

        return request;
    }
}