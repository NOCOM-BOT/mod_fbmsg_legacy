import "./FCATypes";
import fcaLogin from "fca-unofficial";
import FacebookBasicLoginHandler from "./Facebook_BasicLogin";
import HTTPContext from "./HTTPContext";

type FCA_AppState = {
    key: string,
    value: string,
    domain: string,
    path: string,
    hostOnly: boolean,
    creation: string,
    lastAccessed: string
}[];

export default class FCAInstance {
    accountName = "";
    rawAccountID = "";
    formattedAccountID = "";

    fca?: Awaited<ReturnType<typeof fcaLogin>>;

    constructor() {}

    async login({
        state,
        username,
        password,
        twoFactorSecret
    }: Partial<{
        state: FCA_AppState;
        username: string;
        password: string;
        twoFactorSecret: string;
    }>) {
        if (state) {
            try {
                return this.loginState(state);
            } catch (e) {
                if (username && password) {
                    return this.loginState(await this.loginUPEngine(username, password, twoFactorSecret));    
                } else {
                    throw new Error("Failed to login with state, and no username/password provided");
                }
            }
        } else {
            if (username && password) {
                return this.loginState(await this.loginUPEngine(username, password, twoFactorSecret));    
            } else {
                throw new Error("No state provided, and no username/password provided");
            }
        }
    }

    async loginUPEngine(username: string, password: string, twoFactorSecret?: string): Promise<FCA_AppState> {
        let ctx = new HTTPContext();
        let loginHandler = new FacebookBasicLoginHandler();

        await loginHandler.login(ctx, username, password, twoFactorSecret);

        return (await ctx.jar.getCookies("https://www.facebook.com"))
            .concat(await ctx.jar.getCookies("https://facebook.com"))
            .concat(await ctx.jar.getCookies("https://www.messenger.com"))
            .map(cookie => ({
                key: cookie.key,
                value: cookie.value,
                domain: cookie.domain ?? "facebook.com",
                path: cookie.path ?? "/",
                hostOnly: cookie.hostOnly ?? false,
                creation: cookie.creation?.toISOString() ?? "1970-01-01T00:00:00.001Z",
                lastAccessed: cookie.lastAccessed?.toISOString() ?? "1970-01-01T00:00:00.001Z"
            }));
    }

    async loginState(state: FCA_AppState) {
        this.fca = await fcaLogin({
            appstate: state
        }, {
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063",
            logLevel: "silent",
            selfListen: true,
            listenEvents: true,
            updatePresence: false,
            autoMarkRead: false,
            autoMarkDelivery: false,
            forceLogin: false
        });

        this.rawAccountID = this.fca.getCurrentUserID();
        this.formattedAccountID = `${this.rawAccountID}@User@Facebook`;
        let data_currentUser = await this.fca.getUserInfo(this.rawAccountID);
        
        this.accountName = data_currentUser[this.rawAccountID].name;

        return this.fca;
    }
}
