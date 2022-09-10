# mod_fbmsg_legacy for NOCOM_BOT

This is a module that add supports for Facebook bot account, following <a href="https://github.com/NOCOM-BOT/spec/blob/main/Module.md#51-interface-handler-module-type--interface">NOCOM_BOT module specification for interface - version 1</a>.

This module uses <a href="https://npmjs.org/package/fca-unofficial">fca-unofficial</a> as backend.

Status: Testing

**PLEASE NOTE THAT THE AUTHOR DOES NOT HOLD ANY LIABILITY SHOULD ANYTHING HAPPENS WITH YOUR FACEBOOK ACCOUNTS. RUNNING SELF-BOT ACCOUNT IS AGAINST FACEBOOK'S TERMS OF SERVICE.**

**THE BACKEND MODULE USED IN THIS MODULE IS NOT BEING MAINTAINED! AS A RESULT, THE AUTHOR WILL NOT PROVIDE SUPPORT FOR ANY PROBLEMS FOUND WHEN RUNNING THIS MODULE.**

## Login data parameter

```ts
{
    username?: string,
    password?: string,
    twoFactorSecret?: string,
    appstateLocation?: string
}
```

This module will test for appstate first, if the module cannot login using appstate from previous session, it will automatically use username and password (and 2FA secret for generating code, if enabled) and create a new appstate.

`twoFactorSecret` is a Base32-encoded secret used for generating 2FA codes. It is the "manual typing code" when you enable 2FA on your account.

`appstateLocation` is saving location for appstate that can be used for future sessions. While it's optional, you are advised to add this to reduce the chance of getting blocked because of logging in too much.

## Additional interface data in message event

`additionalInterfaceData` will have 4 keys: `rawData`, `additionalAttachments`, `isDM`, `isReply`

- `rawData`: This is the raw message directly from `fca-unofficial`
- `additionalAttachments`: `attachment.type` `location` and `share` can be found here, since they do not fit in the main attachments form.
    - `attachment.type === "location"` will have `location` with key `lat` and `lon`.
    - `attachment.type === "share"` will have `url` as target link in a share.
- `isDM`: Self-explaintory
- `isReply`: Also self-explaintory.
