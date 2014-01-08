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
        var inputNodem, value, isDisable, name, inputType, selects, selectNode, action, formData;
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

            var enctype = formNode.getAttribute('enctype');
            if (enctype == "application/x-www-form-urlencoded") {
                formData = new FormData();
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
                    } else if (inputType == "file") {
                        value = inputNode.getDOMNode().files[0];
                    } else {
                        param[name] = value;
                    }
                    if (formData) formData.append(name, value); 
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
                if (formData) formData.append(name, value);
            }

            if (formData) param = formData;

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
