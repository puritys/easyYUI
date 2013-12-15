YUI.add("translator", function(Y) {

    function Translator() {
        this._module = "translator";
        this._lang   = Y.Intl.getLang("translator");
    }

    Translator.prototype = {
        constructor : Translator,
        get_string : function(key, data) {
            var source = Y.Intl.get(this._module, key, this._lang);
            if (typeof(data) == 'object') {
                return Y.substitute(source, data);
            }
            return source;
        }
    }

    Y.Translator = Translator;

}, "0.0.0", {lang: ["zh-TW", "en-US"], requires: ["intl", "substitute"]}); 
// http://yuilibrary.com/yui/docs/intl/intl-basic.html
YUI.add("lang/translator_zh-TW", function(Y) {

         Y.Intl.add(
             "translator",
             "zh-TW",
             {
                 "GENERIC_MORE": "更多",
                 "GENERIC_MORE_DETAIL": "詳細說明",
                 "GENERIC_NEXT": "下一步",
                 "GENERIC_PREV": "上一步",
                 "GENERIC_CANCEL": "取消",
                 "GENERIC_CONFIRM": "確定",
                 "GENERIC_ADEQUATE": "充足",
                 "GENERIC_NOTICE_DIALOG_TITLE": "Notice",
                 "GENERIC_PRICE": "<span class=\\\"dollar-sign\\\">$</span><span class=\\\"number\\\">{PRICE}</span>",
                 "GENERIC_PIECE": "件",
                 "GENERIC_TRY_AGAIN": "再試一次",
                 "GENERIC_VALIDATE_FAIL": "資料填寫有誤，請重新輸入",

                 // GENERIC Error
                 "GENERIC_ERROR_TITLE": "錯誤訊息",
                 "GENERIC_ERROR_SYSTEM": "資料擷取失敗，請稍後再試"

 
             }
         );
     }, "3.1.0");
/**
* 1. zIndex manager
* 2. YUI use manager
* 3. utility
* 4. config, setting
*/
YUI.add("easyYUI_core", function (Y) {
    var obj = {},
        attrs = {};

    attrs.env = {
        value: "production" //alpha, beta...
    };

    attrs.zIndex = {
        value: 100
    };

    /**
    * How many milliseconds we will execute something.
    *
    * @property time
    * @type {Int}
    */
    attrs.timeToExecute = {
        value: 7000
    };

    /**
    * How many milliseconds we will finish action.
    *
    * @property durationToAnimation
    * @type {Int}
    */
    attrs.durationToFinish = {
        value: 700
    };

    /**
     * YUI modules
     * This arrtibute will be used in YUI().use('???
     */
    attrs.modules = {//{{{
        value: "",
        setter: function (val) {
            var m = this.get('modules'),
                i = 0,
                n;
            if (!Y.Lang.isArray(val)) {
                val = val.split(/,/);
            }
            n = val.length;
            for (i; i < n; i++) {
                m.push(val[i]);
            }
            return m;
        }
    };//}}}

    obj.initializer = function () {
    };

    /**
     * get css zIndex , auto increment
     */
    obj.getZIndex = function () {
        var zIndex = this.get('zIndex');
        zIndex++;
        this.set('zIndex', zIndex);
        return zIndex;
    };



    /**
    * add new parameter to build a new url.
    * Auto add ? or & ,   Auto replace the same key
    **/
    obj.addUrlParameter = function (url, obj, isReplace) {
        var isFirst = true, reg;
        if (typeof(replace) == "undefined") {
            isReplace = true;
        }
        if (url.match(/\?/)) {
            isFirst = false;
        }

        for (pro in obj) {
            if (obj.hasOwnProperty(pro)) {
                if (isFirst) {
                    url += "?";

                    isFirst = false;
                } else {
                    url += "&";

                }

                reg = new RegExp("([&\?])" + pro + "=[^&]*", "g");
                if (isReplace == true && url.match(reg)) {
                    url = url.replace(reg, RegExp.$1 + pro + "=" + obj[pro]);
                } else {
                    url += pro + "=" + obj[pro];
                }
            }
        }

        url = url.replace(/&{2,}/g, '&');
        return url;
    };

    /**
     * sprintf
     *
     * @method sprintf
     */
    obj.sprintf = function (message, param) {/*{{{*/
        var msg = message;
        var REG, i, n;
        REG = /\{[0-9]+\}/;
        if(param) {
            n = param.length;
            for (i=0; i<n ;i++) {
                msg = msg.replace(REG, param[i]);
            }
        }
        return msg;
    };/*}}}*/

    /**
    * Convert full width characters to half width characters
    * @method convertFullwidthChars
    * @param {String} the string to convert
    * @param {String} the converted string
    */
    obj.convertFullwidthChars = function (str) {
        if (!Y.Lang.isString(str)) {
            return str;
        }
        return str.replace(/[\uff01-\uff5e]/g,
            function (a) {
                return String.fromCharCode(a.charCodeAt(0)-65248);
            }).replace(/\u3000/g," ");
    };

    /**
     * return false , if user input is not a number 0~9 , But allow user keyin [enter, <F5>, backspace]
     * keyCode: 37 left arrow, 39 right arrow, 46 delete, 36: home, 35 end, 8 backspace, 9 tab
     * We could add "ime-mode: disable"  style that could disable input source of chinese only in IE
     * @method isNumberKeyCode
     */
    obj.isNumberKeyCode = function (event) {/*{{{*/
        var key = event.keyCode;
        var val = String.fromCharCode(key);

        var acceptCode = [ 8, 9, 13, 36, 35, 37, 39, 46, 116, 96, 97 ,98, 99, 100, 101, 102, 103, 104, 105];
        //Y.log("keyCode = " + key + " value = " + val + "  which = " + event.which , "info");
        //Y.log(event, "info");

        if (event.ctrlKey) {
            return true;
        }

        if (event.metaKey) {
            return true;
        }

        if (key === 13) {
            return false;
        }

        if (event.shiftKey && key >=48 && key<= 57) {
            return false;
        }

        if (Y.Array.indexOf(acceptCode, key) === -1  && !val.match(/[0-9]/)) {
            return false;
        }
        return true;
    };/*}}}*/



    Y.namespace('easyYUI').core = Y.Base.create('easyYUI_core', Y.Base, [],
        obj,
        {
            ATTRS: attrs
        }
    );

    obj = null;
    attrs = null;
    
    Y.namespace('easyYUI_obj').core = new Y.easyYUI.core();

    Y.log("Load YUI Module [easyYUI_core] success.", "info")
}, '', {requires: ['base', 'datatype-number', 'lang']});
YUI.add("easyYUI_ui", function (Y) {

    var obj = {},
        attrs = {};





    /*#############################################
    ###                Method start             ###
    #############################################*/
    obj.scrollHeight = 0;
    obj.scrollDirection = 0;
    obj.scrollTimer = null;

    /**
    * initializer
    *
    * @method initializer
    * @param {Node} elm element
    */
    obj.initializer = function () {
        this.core = Y.easyYUI.core;
        this.clickedNode = '';
        this.clickedOverlay = '';

    };

    /**
    * Create a overlay to cover whole page
    *
    * @method renderMask
    * @param {Node} elm element
    */
    obj.renderMask = function () {
        Y.one(document.body).append('<div class="page-mask"></div>');
    };


    /**
    * Create a white overlay to cover a layer.
    * If type = btn , it will create a overlay to cover button.
    * If type = page, it will create a overlay to cover whole page.
    * If type = div, it will create a div inside the node which you point. The new div'position is controlled by css, no matter how window size change, It will always cover the node fixedly.
    *
    * @method renderLoading
    * @param {String} type page,btn,div
    * @param {Node} elm element
    */
    obj.renderLoading = function (type, node) {//{{{
        var overlay, div;
        var width, height;
        var attrs = {
            headerContent:"",
            bodyContent: '', // Didn't need loading  '<div class="loading"></div>',
            footerContent:"",
            centered: true
        };

        if (type === 'page') {
            this.renderMask();
            overlay = new Y.Overlay(attrs);
            overlay.render("body");

        } else if (type === 'btn') {
            if (!node) {
                Y.log("Node is missing, when I try to render loading div." , "error");
            }
            width = node.get('offsetWidth'); 
            height = node.get('offsetHeight');
            attrs.width = width;
            attrs.height = height;
            overlay = new Y.Overlay(attrs);
            overlay.render("body");
            overlay.align(node, [Y.WidgetPositionAlign.TL, Y.WidgetPositionAlign.TL]);
            overlay.get("boundingBox").addClass('btn-mask');
        }
/* else if (type === 'div') {
            if (!node) {
                Y.log("Node is missing, when I try to render loading div." , "error");
            }
            div = Y.Node.create('<div class="div-mask"></div>');
            //set style in css
            node.appendChild(div);
        }*/

        this.clickedOverlay = overlay;
        return overlay;
    };//}}}

    /**
    * Disable the button and create a mask to cover it.
    * If you want to create page mask , Just to set type = page
    *
    * @method preventDoubleClick
    * @param {Node} elm element
    */
    obj.preventDoubleClick = function (node, type) {//{{{
        var overlay;
        this.clickedNode = node;
        node.setAttribute('disabled', true);
        if (!type) {
            type = 'page';
        }
        overlay = this.renderLoading(type, node);
        return {buttonNode: node, loadingLayer: overlay}
    };//}}}

    /**
    * Remove the layer which created by method preventDoubleClick 
    *
    * @method preventDoubleClose
    * @param {Node} elm element
    */
    obj.preventDoubleClose = function (overlay, node) {//{{{
        var mask;
        if (node) {
            node.removeAttribute('disabled');
        }

        mask = Y.one('.page-mask');
        if(mask) {
            mask.remove();
        }
        if(overlay) {
            overlay.destroy();
        } 

/*else if (this.clickedOverlay) {
            this.clickedOverlay.destroy();
        }
        this.clickedOverlay = null;
        this.clickedNode = null;*/
    };//}}}


    /**
    * Remove the node after x seconds
    *
    * @method deleteNodeLater
    * @param {Node} which node need to hide.
    * @param {Int} How many ms will to execute.(millisecond)
    * @param {args} {deleteStart: CallBack function, deleteEnd: callback function}
    *
    * @return {reference} timer If you need to cancel this event. save this reference of timer
    */
    obj.deleteNodeLater = function (node, ms, args) {
        var trigger, time, timer;
        if (args && args.deleteStart) {
            trigger = args.deleteStart;
        } else {
            trigger = Y.bind(this.handleDeleteNode, this, node);
        }
        if (ms) {
            time = ms;
        } else {
            time = this.core.get('timeToExecute');
        }
        timer = Y.later(time, this, trigger, args);
        return timer;
    };

    /**
    * Remove the node with fantastic animation
    * When we start to remove. We need disable all button first.
    *
    * @method deleteNodeLater
    * @param {Node} which node need to hide.
    * @param {Int} duration How many ms will to execute.(millisecond)
    */
    obj.deleteNode = function (node, duration, args) {
        var dur, callBack;

        if (args && args.deleteEnd) {
            callBack = args.deleteEnd;
        } else {
            callBack = Y.bind(this.deleteNodeEnd, this, node);
        }
        if (duration) {
            dur = duration;
        } else {
            dur = this.core.get('durationToFinish');
        }
        node.all('input, select, button, a').setAttribute('disabled', true);
        Y.one(node).transition({
            duration: dur/1000,
            opacity: {
                delay: 0,
                value: 0
            }   
        }, callBack);

    };

    /**
    * The end of animation.
    *
    * @method deleteNodeLater
    * @param {Node} which node need to hide.
    * @param {Int} duration How many ms will to execute.(millisecond)
    */
    obj.deleteNodeEnd = function (node) {
        node.remove();
    };

    /**
    * handle parameter of delete Node start
    *
    * @method handleDeleteNode
    * @param {Node} which node need to hide.
    * @param {Args} 
    */
    obj.handleDeleteNode = function (node, args) {
        var duration = null;
        this.deleteNode(node, duration, args);
        
    };


    obj.scrollY = function (tNode, config) {
        var paddingTop = 0, isAnimated = true, anim;

        if (typeof(config.isAnimated) != "undefined") isAnimated = config.isAnimated;
        if (config.paddingTop) paddingTop = config.paddingTop;

        if (this.scrollTimer) this.scrollTimer.cancel();
        var h, realScrollY;
        realScrollY = tNode.getY() - paddingTop;
        h = Math.abs(Y.DOM.docScrollY() - realScrollY);

        this.scrollHeight = h;
        this.scrollDirection = Y.DOM.docScrollY() > realScrollY ? -1 : 1;
        if (isAnimated != true) {
            scrollBy(0, (this.scrollDirection) * this.scrollHeight);
            return ;
        }

        anim = Y.bind(this.scrollYAnim, this);
        this.scrollTimer = Y.later(15, this, anim, null, true);
    };

    obj.scrollYAnim = function () {
        var scrollDelta, deltaPercentage = 0.15;
        scrollDelta = Math.ceil(deltaPercentage * this.scrollHeight);
        scrollBy(0, Math.ceil(this.scrollDirection * scrollDelta));
        this.scrollHeight -= scrollDelta;
        if (this.scrollHeight <= 0) {
            this.scrollTimer.cancel();
        }
    };

    Y.namespace('easyYUI').ui = Y.Base.create('easyYUI_ui', Y.Base, [],
        obj,
        {
            ATTRS: attrs
        }
    );

    obj = null;
    attrs = null;
    
    Y.namespace('easyYUI_obj').ui = new Y.easyYUI.ui();
    Y.log("Load YUI Module [easyYUI ui] success", "info");
}, '', {requires: ['base', 'overlay', 'transition']});
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
            zIndex: 401,
            alignOn: [{eventName: "resize", node: Y.one("win")}]
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
/**
*
* @namespace easyYUI
* @class ioUtility
* @constructor
*/

YUI.add("easyYUI_io", function (Y) {

    function ioUtility() {
        this.ui = Y.easyYUI_obj.ui;
        this.core = Y.easyYUI_obj.core;

    }
    var o = ioUtility.prototype;

    /**
     * make a request to a url. Have three type :ajax,get,post
     *
     * @method request
     * @param {String} type Select a protocol , ajax or get or post or ajaxpost
     * @param {String} url  The url to request
     * @param {function} callBack callback function , Using Y.bind(xx, this);
     * @param {array} args The argument of js.
     **/
    o.request = function (type, url, param, callBack, args) {//{{{
        var splitPm, i ,n, match, paramAy = {}, formNode, inputs;
        var inputNodem, value, isDisable, name, inputType, selects, selectNode, action;
        if (!type)  {
            type = "ajax";
        }
        if (!args) {
            args = {};
        }

        if (param && Y.Lang.isFunction(param.one)) {
            formNode = param;
            param = {};
            if (!url) {
                action = formNode.getAttribute('action');
                if (action) url = action;
            }
            if (type != "pjax") {
                method = formNode.getAttribute('method');
                if (!method) {
                    method = "get";
                } else { 
                    method = method.toLowerCase();
                }
                type = (method == "get")?'ajax': "ajaxpost";
            }
            inputs = formNode.all('input');
            n = inputs.size();
            for (i = 0; i < n ; i++) {
                inputNode = inputs.item(i);
                isDisable = inputNode.get('disabled');
                if (!isDisable) {
                    inputType = inputNode.get('type');
                    value = inputNode.get('value');
                    name = inputNode.get('name');
                    if (!name) continue;
                    if (inputType == "radio") {
                        checked = inputNode.get('checked');
                        if (!checked) continue;
                        param[name] = value;
                    } else if (inputType == "checkbox") {
                        checked = inputNode.get('checked');
                        if (!checked) continue;
                        if (!param[name]) param[name] = [];
                        param[name].push(value);
                    } else {
                        param[name] = value;
                    }
                    
                }
            }

            selects = formNode.all('select');
            n = selects.size();
            for (i = 0; i < n; i++) {
                selectNode = selects.item(i);
                value = selectNode.get('value');
                name = selectNode.get('name');
                if (!name) continue;
                param[name] = value;

            }
        } else if (Y.Lang.isString(param)) {
            splitPm = param.split(/&/);
            n = splitPm.length;
            for (i = 0; i < n; i++) {
                match = splitPm[i].match(/([^=]+)=([^\n\r]+)/);
                paramAy[match[1]] = match[2];
            }
            param = paramAy;
        }

        type = type.toLowerCase();
        if (type === "ajax") {
            this.requestAJAX(url, param, callBack, 'GET', args);

        } else if (type === "pjax") {

            url = this.core.addUrlParameter(url, param, true);
            this.addHistory(url);
            this.requestAJAX(url, {pjax:1}, callBack, 'PJAX', args);

        } else if (type === "ajaxpost") {
            this.requestAJAX(url, param, callBack, 'POST', args);
        } else if (type === "get") {
            this.requestGet(url, param);
        } else if (type === "post") {
            this.requestPost(url, param);
        }

    };//}}}

    /**
     * make a request with parameter by ajax.
     *
     * @method requestAJAX
     **/
    o.requestAJAX = function (url, param, callBack, method, args) {//{{{
        var ioCfg, httpMethod;
            random = Math.round(Math.random() * 100000);

        httpMethod = method;

        var clickedOverlay = "", clickedNode = "", complete;
        param.isAJAX = true;
        if (url.match(/\?/)) {
            url += '&r='+random; 
        } else {
            url += '?r='+random;
        }

        if (this.ui.clickedOverlay) {
            clickedOverlay = this.ui.clickedOverlay;
//            this.ui.clickedOverlay = null;
        }

        if (this.ui.clickedNode) {
            clickedNode = this.ui.clickedNode;
//            this.ui.clickedNode = null;
        }

        complete = Y.bind(this.ajaxResponse, this);

        if (method == "PJAX") {
            httpMethod = "GET";
        } 

        param.isAJAX = true;

        ioCfg = { 
            method: httpMethod,
            data: param,
            on: {
                complete: complete
            },
            arguments: {
                callBack: callBack,
                param: param,
                callBackArgs: args,
                clickedOverlay: clickedOverlay,
                clickedNode: clickedNode
            }
        };
        Y.io(url, ioCfg);
    };//}}}

    o.ajaxResponse = function (trans_id, res, args) {
        var text = res.responseText,
            title,
            message,
            status;

        status = res.status.toString().substr(0 ,1);

        this.ui.preventDoubleClose(args.clickedOverlay, args.clickedNode);

        if (!args.callBackArgs) {
            args.callBackArgs = {};
        }

        if (status == 4 || status == 5) { //401, 402 403 500
            title = Y.easyYUI_obj.translator.get_string('GENERIC_ERROR_TITLE');
            message = Y.easyYUI_obj.translator.get_string('GENERIC_ERROR_SYSTEM');
            Y.easyYUI_obj.dialog.display({title: title, message:message});      
        }


        try {
            text = Y.JSON.parse(text);
        } catch (e) {
            Y.log("Ajax resopnse is not a JSON format", "info");
            return args.callBack(text, args.param, args.callBackArgs);
        }

        return args.callBack(text, args.param, args.callBackArgs);
    };

    /**
     * make a request with parameter by Get method.
     **/
    o.requestGet = function (url, param) {//{{{
        var get = "",
            key, originParam, match, i ,n;
        if (!url) {
            //If url is empty , get th original url
            url = window.top.location.pathname;
            originParam = window.top.location.search.split(/[\?&]/);
            n = originParam.length;
            for (i = 0; i < n; i++) {
                match = originParam[i].match(/([^=]+)=([^\n\r]+)/);
                if (match && !param[match[1]]) {
                    param[match[1]] = match[2];
                }
            }
        }
        if (param) {
            if (url.match(/\?/, get)) {
                get += "&";
            } else {
                get += "?";
            }
            for (key in param) {
                if (param.hasOwnProperty(key)) {
                    get +=  key + "=" + param[key] + "&";
                }
            }
            url += get;
        }
        window.top.location.href = url;

    };//}}}

    /**
     * make a request form with parameter input by Post method.
     **/
    o.requestPost = function (url, param) {//{{{
        var form = '<form id="autoRedirect" action="' + url + '" method="post">',
            key;
        if (param) {
            for (key in param) {
                if (param.hasOwnProperty(key)) {
                    form += '<input type="hidden" name="' + key + '" value="' + param[key] + '" />';
                }
            }
        }
        form += '</form>';
        Y.one(document.body).append(form);
        Y.one("#autoRedirect").submit();
    };//}}}

    o.addHistory = function (url, title) {
        if (!title) {
            title = "Default Title";
        }
        if (typeof history.pushState !== 'undefined') {
            history.pushState("", title, url);
        }
    };

    Y.namespace("easyYUI_obj").io = new ioUtility();
    Y.log("YUI Module [easyYUI_io] success", "info");


}, '', {requires: ['json-parse', 'io', 'easyYUI_core', 'easyYUI_ui', 'lang']});
YUI.add("easyYUI_dragDrop", function (Y) {

    var obj = {},
        attrs = {};

    obj.initializer = function () {

    };

    obj.init = function () {
        this.previewNode = null;
        if (this.lastTouchedNode) {
            this.lastTouchedNode.setData("easyYUI_isTouched", false);
        }

    };

    obj.deleteEvent = function () {
        Y.detach(this.mousemoveEvent);
        Y.detach(this.mouseupEvent);
        this.dragCanvas.addClass('hidden');
    };

    obj.dragTo = function (node, touchNodeClass, callback) {
        var dragCanvasHTML, cloneNode;
        this.startX = window.event.pageX;
        this.startY = window.event.pageY;

        this.init();
        if (!this.dragCanvas) {
            this.dragCanvas = Y.one(".easyYUI-drag-canvas");
            if (!this.dragCanvas) {
                dragCanvasHTML = '<div class="easyYUI-drag-canvas">.</div>';
                this.dragCanvas  = Y.one("body").appendChild(dragCanvasHTML);
            }
        }
        this.dragCanvas.removeClass('hidden');

        this.originNode = node;
        this.originNode.setData('easyYUI_isDrag', true);

        cloneNode = node.cloneNode(1);
        this.copyNode = Y.Node.create("<div></div>");
        this.copyNode.appendChild(cloneNode);
        
        this.originNode.addClass('easyYUI_dragOrigin');
        this.callback = callback;
        var width = node.get('offsetWidth');
        var height = node.get('offsetHeight');
        this.offsetLeft = width/2 * (-1);
        this.offsetTop = height/2 * (-1);
        this.touchParent = Y.one(touchNodeClass).ancestor();
        this.childNodes = Y.all(touchNodeClass);
        Y.one("body").append(this.copyNode);
        this.copyNode.setStyles({
            "position": "absolute", "zIndex": "999",
            "width": node.get('offsetWidth'),
            "height": node.get('offsetHeight'),
            "padding": 0
        });
        this.initBindEvent(touchNodeClass);
    };

    obj.initBindEvent = function (touchNodeClass) {
        var moveCallback, endCallback, touchCallback;
        moveCallback = Y.bind(this.nodeMove, this);
        endCallback = Y.bind(this.nodeMoveEnd, this);
        touchCallback = Y.bind(this.nodeTouch, this);

        this.mousemoveEvent = this.dragCanvas.on('mousemove', moveCallback);
        this.mouseupEvent = this.dragCanvas.on('mouseup', endCallback);

    };

    obj.nodeMove = function (E) {
        Y.log("mouse move", "debug");
        var pos = {}, mousex, mousey;
        E.halt();
        mousex = E.pageX;
        mousey = E.pageY;
        pos.left = E.pageX + this.offsetLeft;
        pos.top = E.pageY + this.offsetTop;
        this.copyNode.setStyles(pos);
        var i, n, region, position = "before";
        n = this.childNodes.size();
        for (i = 0; i < n; i++) {
            region = this.childNodes.item(i).get('region');
            if ((mousex > region.left && mousex < region.right)
                && (mousey < region.bottom && mousey > region.top)
            ) {
                if (Math.abs(E.pageX - this.startX) > Math.abs(E.pageY - this.startY)) {
                    if ((mousex - region.left) > (region.right - region.left)/2) {
                        position = "after";
                    }
                } else {
                    if ((mousey - region.bottom) > (region.top - region.bottom)/2) {
                        position = "after";
                    }

                }
                this.nodeTouch(this.childNodes.item(i), position);
                break;
            }
        }
    };

    obj.nodeMoveEnd = function (E) {
        Y.log("mouse up", "debug");
        var isSuccess = false;
        E.halt();
        this.deleteEvent();
        this.copyNode.remove();
        this.originNode.removeClass('easyYUI_dragOrigin');
        if (!this.previewNode) {
            return ;
        }
        if (this.callback) {
            if (this.callback.drop){ isSuccess = this.callback.drop();}
        }

        if (isSuccess) {
            this.originNode.remove();
            this.previewNode.removeClass('easyYUI_dragOrigin');
        } else {
            if (this.previewNode) this.previewNode.remove();
        }
    };

    obj.nodeTouch = function (touchedNode, position) {
        if (touchedNode.getData("easyYUI_isDrag")) return ;
        if (this.lastTouchedNode) {
            if (this.lastPosition == position && this.lastTouchedNode.getData("easyYUI_isTouched")) {
                return ;
            }
            this.lastTouchedNode.setData("easyYUI_isTouched", false);
        }
        touchedNode.setData("easyYUI_isTouched", true);
        this.lastTouchedNode = touchedNode;
        this.lastPosition = position;
        this.insertNode(touchedNode, position);

    };

    obj.insertNode = function (touchedNode, position) {
        if (this.previewNode) this.previewNode.remove();
        var previewNode = this.originNode.cloneNode(1);
        previewNode.setData("easyYUI_cloneNode", true);
        previewNode.removeClass("easyYUI_dragOrigin");
        this.previewNode = previewNode;
        touchedNode.insert(previewNode, position);

    };

    Y.namespace('easyYUI').dragDrop = Y.Base.create('easyYUI_dragDrop', Y.Base, [],
        obj,
        {
            ATTRS: attrs
        }
    );


    obj = null;
    attrs = null;
    
    Y.namespace('easyYUI_obj').dragDrop = new Y.easyYUI.dragDrop();
    Y.log("Load YUI Module [easyYUI dragDrop] success", "info");
}, '', {requires: ['base', 'transition', 'event-move']});
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
