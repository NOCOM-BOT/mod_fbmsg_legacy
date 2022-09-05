import "./FCATypes";
import fcaLogin from "fca-unofficial";

export default class FCAInstance {
    accountName = "";
    rawAccountID = "";
    formattedAccountID = "";

    fca?: Awaited<ReturnType<typeof fcaLogin>>;

    constructor() {}

    async login(username: string, password: string, state: any) {
        if (state) {
            return this.loginState(state);
        } else {
            return this.loginState(await this.loginUPEngine(username, password));
        }
    }

    async loginUPEngine(username: string, password: any) {
        throw new Error("not implemented");
    }

    async loginState(state: any) {
        this.fca = await fcaLogin({
            appstate: state
        });

        this.rawAccountID = this.fca.getCurrentUserID();
        this.formattedAccountID = `${this.rawAccountID}@!!Facebook###User`;
        let data_currentUser = await this.fca.getUserInfo(this.rawAccountID);
        
        this.accountName = data_currentUser[this.rawAccountID].name;
    }
}
