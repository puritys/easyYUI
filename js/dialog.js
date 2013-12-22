YUI.add("easyYUI_dialog", function(Y) {
    var obj = {};

    function dialog(config) {
        dialog.superclass.constructor.apply(this, arguments);
    }

    dialog.NAME = "panel";
    
    obj.initializer = function () {
        if (Y.easyYUI_obj && Y.easyYUI_obj.translator) {
            this.trans = Y.easyYUI_obj.translator;
        } else {
            Y.log("Missing Javascript translator.", "error");
        }
        this.setAttrs({
            visible: false,
            centered: true,
            modal: true,
            zIndex: 401
            //alignOn: [{eventName: "resize", node: Y.one("win")}]
        });
        this.render("body");
        this.get("boundingBox").addClass("msg-dialog-wrap");
        this.get("contentBox").addClass("msg-dialog");

        this.dialogIcon = null;            
        this.dialogTitle = Y.Node.create("<h3/>").addClass("title"),
        this.dialogMessage = Y.Node.create("<div/>").addClass("message");
        this.setStdModContent(Y.WidgetStdMod.HEADER, this.dialogTitle);
        this.setStdModContent(Y.WidgetStdMod.BODY, this.dialogMessage);

    };

    obj.display = function (dialogCfg) {
        var btnConfig, callback;
        var title = dialogCfg.title || "",
            message = dialogCfg.message || "",
            footerButtons = this.get("buttons")[Y.WidgetStdMod.FOOTER];
        
        if (this.dialogIcon) {
            this.dialogIcon.remove(true);
        }
        this.dialogTitle.setHTML(title);
        this.dialogMessage.setHTML(message);

        Y.Array.each(footerButtons, function (item, index, array) {
            this.removeButton(item);
        }, this);

        if (dialogCfg.callbackObj && dialogCfg.callbackObj.ok) {
            var callbackObj = dialogCfg.callbackObj;
            if (callbackObj && callbackObj.ok) {
                callback = callbackObj.ok;
                btnConfig = {
                    value: this.trans.get_string("GENERIC_CONFIRM"),
                    section: Y.WidgetStdMod.FOOTER,
                    action: callback
                };
                this.addButton(btnConfig);

            }
            if (callbackObj && callbackObj.cancel) {
                if (Y.Lang.isString(callbackObj.cancel) && "hide" == callbackObj.cancel) {
                    callback = Y.bind(this.hide, this);
                    btnConfig = {
                        value: this.trans.get_string("GENERIC_CANCEL"),
                        section: Y.WidgetStdMod.FOOTER,
                        action: callback
                    };
                    this.addButton(btnConfig);

                } else {
                    callback = callbackObj.cancel;
                    btnConfig = {
                        value: this.trans.get_string("GENERIC_CANCEL"),
                        section: Y.WidgetStdMod.FOOTER,
                        action: callback
                    };
                    this.addButton(btnConfig);
                }
            }
        } else {
            callback = Y.bind(this.hide, this);
            btnConfig = {
                value: this.trans.get_string("GENERIC_CONFIRM"),
                section: Y.WidgetStdMod.FOOTER,
                action: callback
            };
            this.addButton(btnConfig);

        }
        this.show();
        return this;
    };


    Y.extend(dialog, Y.Panel, obj);

    Y.namespace("easyYUI").dialog = dialog;
    Y.log("Load YUI Module [easyYUI_dialog] success");

}, "", {requires: ["array-extras", "panel", "easyYUI_core"]});
