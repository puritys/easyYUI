/**
*/
YUI.add("easyYUI", function (Y) {
    var obj = {},
        attrs = {};


    if (Y.Translator) {
        Y.namespace('easyYUI_obj').translator = new Y.Translator();
    }

    if (Y.easyYUI.dialog) {
        Y.namespace('easyYUI_obj').dialog = new Y.easyYUI.dialog();
    }

    obj.initializer = function () {
        //The node I find, Using node to get this node, nodes to get the array
        this.node = ""; 
        this.nodes = ""; 
    };

    /**
    translator
    @param key
    $param args
    */
    obj.translate = function (key, data) {
        return Y.easyYUI_obj.translator.get_string.call(Y.easyYUI_obj.translator, key, data);
    }
    /**
    popAlert
    Display a dialog
    */
    obj.alert = obj.popDialog = function (messageObj, callbackObj) {
        var title ="", message = "", conf;
        if (Y.Lang.isObject(messageObj) && messageObj.title) {

        } else {
            message = messageObj;

        }

        if (!callbackObj) {
            callbackObj = {};
        }

        conf = {
            type: "dialog",
            title: title,
            message: message,
            callbackObj: callbackObj
        };
        return Y.easyYUI_obj.dialog.display.call(Y.easyYUI_obj.dialog, conf);
    };

    obj.ajax = function (url, param, callback, args) {
        if (!args) { args = {};}
        Y.easyYUI_obj.io.request.call(Y.easyYUI_obj.io, "ajax", url, param, callback, args);
    };
 
    obj.pjax = function (url, param, callback, args) {
        if (!args) { args = {};}
        Y.easyYUI_obj.io.request.call(Y.easyYUI_obj.io, "pjax", url, param, callback, args);
    };

    obj.ajaxPost = function (url, param, callback, args) {
        if (!args) { args = {};}
        Y.easyYUI_obj.io.request.call(Y.easyYUI_obj.io, "ajaxpost", url, param, callback, args);
    };

    obj.loading = function (node, type) {
        if (!type) { type = "page";}
        node = Y.one(node);
        Y.easyYUI_obj.ui.renderLoading.call(Y.easyYUI_obj.ui, type, node);
    };
 
    obj.scrollY = function (node, config) {
        Y.easyYUI_obj.ui.scrollY.call(Y.easyYUI_obj.ui, node, config);
    };

    obj.find = obj.query = function (id) {
        var nodes = Y.all(id), i, n;
        this.nodes = null;
        this.node = null;
        n = nodes.size();
        for (i = 0; i < n; i++) {
            if (i == 0) {
                this.node = nodes.item(0);
                this.nodes = [];
            }
            this.nodes.push(nodes.item(i));
        }


        return this;
    };

    obj.dragTo = function (node, touchNodeClass, callback) {
        Y.easyYUI_obj.dragDrop.dragTo.call(Y.easyYUI_obj.dragDrop, node, touchNodeClass, callback);
    };

    /******yui default********/
    obj.one = function () {
        return Y.one.apply(Y, arguments);
    }; 

    obj.all = function () {
        return Y.all.apply(Y, arguments);
    }; 

    obj.bind = function () {
        return Y.bind.apply(Y, arguments);
    }; 

    Y.namespace('easyYUI').main = Y.Base.create('easyYUI_main', Y.Base, [],
        obj,
        {
            ATTRS: attrs
        }
    );

    window.y = new Y.easyYUI.main();

    Y.log("Load YUI Module [easyYUI] success.", "info")
}, '', {requires: ['node', 'event', 'lang', 'easyYUI_dialog', 'easyYUI_core', 'easyYUI_io', 'easyYUI_ui', 'translator', 'lang/translator_zh-TW', 'easyYUI_dragDrop']});
