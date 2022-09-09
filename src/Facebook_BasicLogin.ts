/*
    Copyright (c) 2021-2022 BadAimWeeb
    This file is licensed under the MIT License.
    You should have received the LICENSE file. Alternatively, license text is also
    available at https://opensource.org/licenses/MIT
    
    BasicLoginHandler is backported from the upcoming facebook-self library.
*/

import { load } from "cheerio";
import qs from "querystring";
import { URL } from "url";
import generate_2fa from "./2FAGenerator";
import type HTTPContext from "./HTTPContext";

export default class FacebookBasicLoginHandler {
    async login(ctx: HTTPContext, email: string, password: string, twoFactorSecret?: string): Promise<string> {
        // Making initial request to get login form.
        let initHTML = await ctx.fetch("https://mbasic.facebook.com/");

        if (!initHTML.ok) throw new Error("Facebook returned HTTP error code " + initHTML.status);

        let iHTMLT = await initHTML.text();
        let $0 = load(iHTMLT);

        let nextURL = (new URL($0("form[method=POST]").attr("action") ?? "/", "https://mbasic.facebook.com/")).toString();
        let postObj: { [key: string]: string } = {};

        $0("form[method=POST] input").each((_i, el) => {
            let $e = $0(el)
            let name = $e.attr("name");
            if (name) postObj[name] = $e.attr("value") ?? "";
        });

        postObj.email = email;
        postObj.pass = password;

        let loginRequest = await ctx.fetch(nextURL, {
            method: "POST",
            headers: {
                "Origin": "https://mbasic.facebook.com",
                "Referer": "https://mbasic.facebook.com/",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: qs.stringify(postObj, "&", "=")
        });

        if (loginRequest.status >= 300 && loginRequest.status < 400) {
            let oldURL = nextURL;
            nextURL = (new URL(loginRequest.headers.get("Location") ?? "/", "https://mbasic.facebook.com/")).toString();

            loginRequest = await ctx.fetch(nextURL, {
                headers: {
                    "Origin": "https://mbasic.facebook.com",
                    "Referer": oldURL
                }
            });
        }

        if (!loginRequest.ok) throw new Error("Facebook returned HTTP error code " + loginRequest.status);

        if (loginRequest.url.startsWith("https://mbasic.facebook.com/checkpoint")) {
            // Checkpoint, either account has 2FA enabled or account is disabled.

            let $1 = load(await loginRequest.text());
            try {
                let oldURL = nextURL;
                nextURL = new URL($1("form[method=post]").attr("action") ?? "/", oldURL).toString();
                if (nextURL.startsWith("https://mbasic.facebook.com/login/checkpoint")) {
                    postObj = {};

                    $1("form[method=POST] input").each((_i, el) => {
                        let $e = $1(el)
                        let name = $e.attr("name");
                        if (name) postObj[name] = $e.attr("value") ?? "";
                    });

                    if (typeof twoFactorSecret === "string") {
                        // 2FA secret, ok.
                        postObj.approvals_code = generate_2fa(twoFactorSecret);
                    } else {
                        throw new Error("Account has 2FA enabled, but no data was given to solve challenge.");
                    }

                    loginRequest = await ctx.fetch(nextURL, {
                        method: "POST",
                        headers: {
                            "Origin": "https://mbasic.facebook.com",
                            "Referer": oldURL,
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: qs.stringify(postObj, "&", "=")
                    });

                    let $2 = load(await loginRequest.text());

                    if ($2("#approvals_code").length) {
                        throw new Error("Account has 2FA enabled, but wrong data was given to solve challenge.");
                    }

                    oldURL = nextURL;
                    nextURL = new URL($2("form[method=post]").attr("action") ?? "/", oldURL).toString();

                    postObj = {};
                    $2("form[method=POST] input").each((_i, el) => {
                        let $e = $2(el)
                        let name = $e.attr("name");
                        if (
                            name && ($e.attr("type") !== "radio" || ($e.attr("type") === "radio" && $e.attr("checked")))
                        ) postObj[name] = $e.attr("value") ?? "";
                    });

                    loginRequest = await ctx.fetch(nextURL, {
                        method: "POST",
                        headers: {
                            "Origin": "https://mbasic.facebook.com",
                            "Referer": oldURL,
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: qs.stringify(postObj, "&", "=")
                    });

                    if (loginRequest.status >= 300 && loginRequest.status < 400) {
                        oldURL = nextURL;
                        nextURL = loginRequest.headers.get("location") ?? "https://mbasic.facebook.com/";

                        loginRequest = await ctx.fetch(nextURL, {
                            headers: {
                                "Origin": "https://mbasic.facebook.com",
                                "Referer": oldURL,
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                            body: qs.stringify(postObj, "&", "=")
                        });
                    }

                    if (loginRequest.url.startsWith("https://mbasic.facebook.com/login/checkpoint")) {
                        // Review recent login... oh
                        let $4 = load(await loginRequest.text());
                        oldURL = nextURL;
                        nextURL = new URL($4("form[method=post]").attr("action") ?? "/", oldURL).toString();

                        postObj = {};
                        $4("form[method=POST] input").each((_i, el) => {
                            let $e = $4(el)
                            let name = $e.attr("name");
                            if (
                                name && ($e.attr("type") !== "radio" || ($e.attr("type") === "radio" && $e.attr("checked")))
                            ) postObj[name] = $e.attr("value") ?? "";
                        });

                        loginRequest = await ctx.fetch(nextURL, {
                            method: "POST",
                            headers: {
                                "Origin": "https://mbasic.facebook.com",
                                "Referer": oldURL,
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                            body: qs.stringify(postObj, "&", "=")
                        });

                        let $5 = load(await loginRequest.text());
                        oldURL = nextURL;
                        nextURL = new URL($5("form[method=post]").attr("action") ?? "/", oldURL).toString();

                        postObj = {};
                        $5("form[method=POST] input").each((_i, el) => {
                            let $e = $5(el)
                            let name = $e.attr("name");
                            if (
                                name && ($e.attr("type") !== "radio" || ($e.attr("type") === "radio" && $e.attr("checked")))
                            ) postObj[name] = $e.attr("value") ?? "";
                        });

                        delete postObj["submit[This wasn't me]"];

                        loginRequest = await ctx.fetch(nextURL, {
                            method: "POST",
                            headers: {
                                "Origin": "https://mbasic.facebook.com",
                                "Referer": oldURL,
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                            body: qs.stringify(postObj, "&", "=")
                        });

                        let $6 = load(await loginRequest.text());
                        oldURL = nextURL;
                        nextURL = new URL($6("form[method=post]").attr("action") ?? "/", oldURL).toString();

                        postObj = {};
                        $6("form[method=POST] input").each((_i, el) => {
                            let $e = $6(el)
                            let name = $e.attr("name");
                            if (
                                name && ($e.attr("type") !== "radio" || ($e.attr("type") === "radio" && !$e.attr("checked")))
                            ) postObj[name] = $e.attr("value") ?? "";
                        });

                        loginRequest = await ctx.fetch(nextURL, {
                            method: "POST",
                            headers: {
                                "Origin": "https://mbasic.facebook.com",
                                "Referer": oldURL,
                                "Content-Type": "application/x-www-form-urlencoded"
                            },
                            body: qs.stringify(postObj, "&", "=")
                        });

                        if (loginRequest.status >= 300 && loginRequest.status < 400) {
                            oldURL = nextURL;
                            nextURL = loginRequest.headers.get("location") ?? "https://mbasic.facebook.com/";
    
                            loginRequest = await ctx.fetch(nextURL, {
                                headers: {
                                    "Origin": "https://mbasic.facebook.com",
                                    "Referer": oldURL,
                                    "Content-Type": "application/x-www-form-urlencoded"
                                },
                                body: qs.stringify(postObj, "&", "=")
                            });
                        }
                    }

                    for (; ;) {
                        if (loginRequest.url.startsWith("https://mbasic.facebook.com/gettingstarted")) {
                            // Oh well, getting started... is this a new account?
                            let $3 = load(await loginRequest.text());
                            oldURL = nextURL;
                            nextURL = new URL($3("a[href$='skip']").attr("href") ?? "/", oldURL).toString();
        
                            loginRequest = await ctx.fetch(nextURL, {
                                headers: {
                                    "Origin": "https://mbasic.facebook.com",
                                    "Referer": oldURL
                                }
                            });
                        } else {
                            break;
                        }
                    }
                } else {
                    throw null;
                }
            } catch (e) {
                throw e ?? new Error("Cannot login with this account. Please double-check the credentials and ensure that account is not disabled/checkpointed.");
            }
        } else if (loginRequest.url.startsWith("https://mbasic.facebook.com/login/save-device")) {
            // Yes, we're logged in.
            let oldURL = nextURL;
            nextURL = "https://mbasic.facebook.com/login/save-device/cancel/?flow=interstitial_nux&nux_source=regular_login";

            let p = await ctx.fetch(nextURL, {
                headers: {
                    "Origin": "https://mbasic.facebook.com",
                    "Referer": oldURL
                },
            });

            for (; ;) {
                if (p.url.startsWith("https://mbasic.facebook.com/gettingstarted")) {
                    // Oh well, getting started... is this a new account?
                    let $2 = load(await p.text());
                    oldURL = nextURL;
                    nextURL = new URL($2("a[href$='skip']").attr("href") ?? "/", oldURL).toString();

                    p = await ctx.fetch(nextURL, {
                        headers: {
                            "Origin": "https://mbasic.facebook.com",
                            "Referer": oldURL
                        }
                    });
                } else {
                    break;
                }
            }
        } else if (loginRequest.url.startsWith("https://mbasic.facebook.com/login")) {
            console.log(loginRequest.url);
            let qu = new URL(loginRequest.url).searchParams;
            switch (qu.get("e")) {
                case "1348020":
                    throw new Error("Wrong password.");
                case "1348028":
                case "1348029":
                    throw new Error("Account not found.");
            }

            throw new Error("Invalid email and/or password.");
        }

        let userID = await this.verify(ctx);
        if (typeof userID === "string") {
            return userID;
        } else {
            throw new Error("Login failed: Account ID not found.");
        }
    }

    async verify(ctx: HTTPContext): Promise<string | null> {
        let mainHTML = await ctx.fetch("https://m.facebook.com/");

        if (!mainHTML.ok) return null;
        let html = await mainHTML.text();
        let CurrentUserInitialDataRegex = /\["CurrentUserInitialData",\[\],(.+?),270]/;
        let o = JSON.parse(html.match(CurrentUserInitialDataRegex)?.[1] ?? "{}");

        if (typeof o.ACCOUNT_ID === "string") {
            if (+o.ACCOUNT_ID === 0 || isNaN(+o.ACCOUNT_ID)) return null;
            return o.ACCOUNT_ID;
        } else {
            return null;
        }
    }

    async close() { }
}