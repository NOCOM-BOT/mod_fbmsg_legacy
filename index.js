/*
Copyright (c) 2022 BadAimWeeb

This file is licensed under the MIT License.
You should have received the LICENSE file. Alternatively, license text is also
available at https://opensource.org/licenses/MIT

Node module: @nocom_bot/mod_interface_fbmsg_legacy
*/

import worker, { parentPort } from "node:worker_threads";
import fcaLogin from "fca-unofficial";

let instanceID = "unknown";
if (worker.isMainThread) {
    console.log("This module must be run using NOCOM_BOT core's module loader.");
    process.exit(1);
}

parentPort.once("message", (data) => {
    if (data.type === "handshake") {
        instanceID = data.id;

        parentPort.postMessage({
            type: "handshake_success",
            module: "interface",
            module_displayname: "Facebook Messenger (legacy) interface",
            module_namespace: "interface_fbmsg_legacy"
        });

        parentPort.on("message", portCallback);
    } else {
        process.exit(1);
    }
});

let instances = {};

class FCAInstance {
    accountName = "";
    rawAccountID = "";
    formattedAccountID = "";

    constructor() {}

    async login(username, password, state) {
        if (state) {
            return this.loginState(state);
        } else {
            return this.loginState(await this.loginUPEngine(username, password));
        }
    }

    async loginUPEngine(username, password) {
        throw new Error("not implemented");
    }

    async loginState(state) {
        this.fca = await fcaLogin({
            appstate: state
        });

        this.rawAccountID = this.fca.getCurrentUserID();
        this.formattedAccountID = `${this.rawAccountID}@!!Facebook###User`;
        let data_currentUser = await this.fca.getUserInfo(this.rawAccountID);
        
        this.accountName = data_currentUser[this.rawAccountID].name;
    }
}

async function portCallback(data) {
    switch (data.type) {
        case "api_call":
            try {
                let response = await handleAPICall(data.call_cmd, data.data);

                if (response.exist) {
                    parentPort.postMessage({
                        type: "api_sendresponse",
                        response_to: data.call_from,
                        exist: true,
                        error: null,
                        data: response.data,
                        nonce: data.nonce
                    });
                } else {
                    parentPort.postMessage({
                        type: "api_sendresponse",
                        response_to: data.call_from,
                        exist: false,
                        nonce: data.nonce
                    });
                }
            } catch (e) {
                parentPort.postMessage({
                    type: "api_sendresponse",
                    response_to: data.call_from,
                    exist: true,
                    error: String(e),
                    data: null,
                    nonce: data.nonce
                });
            }
        case "challenge":
            parentPort.postMessage({
                type: "challenge",
                challenge: data.challenge
            });
    }
}

async function handleAPICall(cmd, data) {
    switch (cmd) {
        case "login":
            if (Object.hasOwn(instances, data.interfaceID)) throw "Interface ID already exist";
            let i;
            await (i = instances[data.interfaceID] = new FCAInstance())
                .loginState(data.loginData.state);
            
            return {
                exist: true,
                data: {
                    success: true,
                    interfaceID: data.interfaceID,
                    accountName: i.accountName,
                    rawAccountID: i.rawAccountID,
                    formattedAccountID: i.formattedAccountID,
                    accountAdditionalData: null
                }
            }
        default:
            return {
                exist: false
            }
    }
}
