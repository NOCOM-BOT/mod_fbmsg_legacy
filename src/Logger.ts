import type CMC from "./CMC";

export default class Logger {
    constructor(cmc: CMC) {
        this.cmc = cmc;
    }

    cmc: CMC;

    verbose(namespace: string, ...data: any) {
        this.cmc.callAPI("core", "log", {
            level: "info",
            namespace,
            data
        });
    }

    debug(namespace: string, ...data: any) {
        this.cmc.callAPI("core", "log", {
            level: "debug",
            namespace,
            data
        });
    }

    info(namespace: string, ...data: any) {
        this.cmc.callAPI("core", "log", {
            level: "info",
            namespace,
            data
        });
    }

    warn(namespace: string, ...data: any) {
        this.cmc.callAPI("core", "log", {
            level: "warn",
            namespace,
            data
        });
    }

    error(namespace: string, ...data: any) {
        this.cmc.callAPI("core", "log", {
            level: "error",
            namespace,
            data
        });
    }

    critical(namespace: string, ...data: any) {
        this.cmc.callAPI("core", "log", {
            level: "critical",
            namespace,
            data
        });
    }
}