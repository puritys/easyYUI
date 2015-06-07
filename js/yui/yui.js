/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('oop', function (Y, NAME) {

/**
Adds object inheritance and manipulation utilities to the YUI instance. This
module is required by most YUI components.

@module oop
**/

var L            = Y.Lang,
    A            = Y.Array,
    OP           = Object.prototype,
    CLONE_MARKER = '_~yuim~_',

    hasOwn   = OP.hasOwnProperty,
    toString = OP.toString;

/**
Calls the specified _action_ method on _o_ if it exists. Otherwise, if _o_ is an
array, calls the _action_ method on `Y.Array`, or if _o_ is an object, calls the
_action_ method on `Y.Object`.

If _o_ is an array-like object, it will be coerced to an array.

This is intended to be used with array/object iteration methods that share
signatures, such as `each()`, `some()`, etc.

@method dispatch
@param {Object} o Array or object to dispatch to.
@param {Function} f Iteration callback.
    @param {Mixed} f.value Value being iterated.
    @param {Mixed} f.key Current object key or array index.
    @param {Mixed} f.object Object or array being iterated.
@param {Object} c `this` object to bind the iteration callback to.
@param {Boolean} proto If `true`, prototype properties of objects will be
    iterated.
@param {String} action Function name to be dispatched on _o_. For example:
    'some', 'each', etc.
@private
@return {Mixed} Returns the value returned by the chosen iteration action, which
    varies.
**/
function dispatch(o, f, c, proto, action) {
    if (o && o[action] && o !== Y) {
        return o[action].call(o, f, c);
    } else {
        switch (A.test(o)) {
            case 1:
                return A[action](o, f, c);
            case 2:
                return A[action](Y.Array(o, 0, true), f, c);
            default:
                return Y.Object[action](o, f, c, proto);
        }
    }
}

/**
Augments the _receiver_ with prototype properties from the _supplier_. The
receiver may be a constructor function or an object. The supplier must be a
constructor function.

If the _receiver_ is an object, then the _supplier_ constructor will be called
immediately after _receiver_ is augmented, with _receiver_ as the `this` object.

If the _receiver_ is a constructor function, then all prototype methods of
_supplier_ that are copied to _receiver_ will be sequestered, and the
_supplier_ constructor will not be called immediately. The first time any
sequestered method is called on the _receiver_'s prototype, all sequestered
methods will be immediately copied to the _receiver_'s prototype, the
_supplier_'s constructor will be executed, and finally the newly unsequestered
method that was called will be executed.

This sequestering logic sounds like a bunch of complicated voodoo, but it makes
it cheap to perform frequent augmentation by ensuring that suppliers'
constructors are only called if a supplied method is actually used. If none of
the supplied methods is ever used, then there's no need to take the performance
hit of calling the _supplier_'s constructor.

@method augment
@param {Function|Object} receiver Object or function to be augmented.
@param {Function} supplier Function that supplies the prototype properties with
  which to augment the _receiver_.
@param {Boolean} [overwrite=false] If `true`, properties already on the receiver
  will be overwritten if found on the supplier's prototype.
@param {String[]} [whitelist] An array of property names. If specified,
  only the whitelisted prototype properties will be applied to the receiver, and
  all others will be ignored.
@param {Array|any} [args] Argument or array of arguments to pass to the
  supplier's constructor when initializing.
@return {Function} Augmented object.
@for YUI
**/
Y.augment = function (receiver, supplier, overwrite, whitelist, args) {
    var rProto    = receiver.prototype,
        sequester = rProto && supplier,
        sProto    = supplier.prototype,
        to        = rProto || receiver,

        copy,
        newPrototype,
        replacements,
        sequestered,
        unsequester;

    args = args ? Y.Array(args) : [];

    if (sequester) {
        newPrototype = {};
        replacements = {};
        sequestered  = {};

        copy = function (value, key) {
            if (overwrite || !(key in rProto)) {
                if (toString.call(value) === '[object Function]') {
                    sequestered[key] = value;

                    newPrototype[key] = replacements[key] = function () {
                        return unsequester(this, value, arguments);
                    };
                } else {
                    newPrototype[key] = value;
                }
            }
        };

        unsequester = function (instance, fn, fnArgs) {
            // Unsequester all sequestered functions.
            for (var key in sequestered) {
                if (hasOwn.call(sequestered, key)
                        && instance[key] === replacements[key]) {

                    instance[key] = sequestered[key];
                }
            }

            // Execute the supplier constructor.
            supplier.apply(instance, args);

            // Finally, execute the original sequestered function.
            return fn.apply(instance, fnArgs);
        };

        if (whitelist) {
            Y.Array.each(whitelist, function (name) {
                if (name in sProto) {
                    copy(sProto[name], name);
                }
            });
        } else {
            Y.Object.each(sProto, copy, null, true);
        }
    }

    Y.mix(to, newPrototype || sProto, overwrite, whitelist);

    if (!sequester) {
        supplier.apply(to, args);
    }

    return receiver;
};

/**
 * Copies object properties from the supplier to the receiver. If the target has
 * the property, and the property is an object, the target object will be
 * augmented with the supplier's value.
 *
 * @method aggregate
 * @param {Object} receiver Object to receive the augmentation.
 * @param {Object} supplier Object that supplies the properties with which to
 *     augment the receiver.
 * @param {Boolean} [overwrite=false] If `true`, properties already on the receiver
 *     will be overwritten if found on the supplier.
 * @param {String[]} [whitelist] Whitelist. If supplied, only properties in this
 *     list will be applied to the receiver.
 * @return {Object} Augmented object.
 */
Y.aggregate = function(r, s, ov, wl) {
    return Y.mix(r, s, ov, wl, 0, true);
};

/**
 * Utility to set up the prototype, constructor and superclass properties to
 * support an inheritance strategy that can chain constructors and methods.
 * Static members will not be inherited.
 *
 * @method extend
 * @param {function} r   the object to modify.
 * @param {function} s the object to inherit.
 * @param {object} px prototype properties to add/override.
 * @param {object} sx static properties to add/override.
 * @return {object} the extended object.
 */
Y.extend = function(r, s, px, sx) {
    if (!s || !r) {
        Y.error('extend failed, verify dependencies');
    }

    var sp = s.prototype, rp = Y.Object(sp);
    r.prototype = rp;

    rp.constructor = r;
    r.superclass = sp;

    // assign constructor property
    if (s != Object && sp.constructor == OP.constructor) {
        sp.constructor = s;
    }

    // add prototype overrides
    if (px) {
        Y.mix(rp, px, true);
    }

    // add object overrides
    if (sx) {
        Y.mix(r, sx, true);
    }

    return r;
};

/**
 * Executes the supplied function for each item in
 * a collection.  Supports arrays, objects, and
 * NodeLists
 * @method each
 * @param {object} o the object to iterate.
 * @param {function} f the function to execute.  This function
 * receives the value, key, and object as parameters.
 * @param {object} c the execution context for the function.
 * @param {boolean} proto if true, prototype properties are
 * iterated on objects.
 * @return {YUI} the YUI instance.
 */
Y.each = function(o, f, c, proto) {
    return dispatch(o, f, c, proto, 'each');
};

/**
 * Executes the supplied function for each item in
 * a collection.  The operation stops if the function
 * returns true. Supports arrays, objects, and
 * NodeLists.
 * @method some
 * @param {object} o the object to iterate.
 * @param {function} f the function to execute.  This function
 * receives the value, key, and object as parameters.
 * @param {object} c the execution context for the function.
 * @param {boolean} proto if true, prototype properties are
 * iterated on objects.
 * @return {boolean} true if the function ever returns true,
 * false otherwise.
 */
Y.some = function(o, f, c, proto) {
    return dispatch(o, f, c, proto, 'some');
};

/**
Deep object/array copy. Function clones are actually wrappers around the
original function. Array-like objects are treated as arrays. Primitives are
returned untouched. Optionally, a function can be provided to handle other data
types, filter keys, validate values, etc.

**Note:** Cloning a non-trivial object is a reasonably heavy operation, due to
the need to recursively iterate down non-primitive properties. Clone should be
used only when a deep clone down to leaf level properties is explicitly
required. This method will also

In many cases (for example, when trying to isolate objects used as hashes for
configuration properties), a shallow copy, using `Y.merge()` is normally
sufficient. If more than one level of isolation is required, `Y.merge()` can be
used selectively at each level which needs to be isolated from the original
without going all the way to leaf properties.

@method clone
@param {object} o what to clone.
@param {boolean} safe if true, objects will not have prototype items from the
    source. If false, they will. In this case, the original is initially
    protected, but the clone is not completely immune from changes to the source
    object prototype. Also, cloned prototype items that are deleted from the
    clone will result in the value of the source prototype being exposed. If
    operating on a non-safe clone, items should be nulled out rather than
    deleted.
@param {function} f optional function to apply to each item in a collection; it
    will be executed prior to applying the value to the new object.
    Return false to prevent the copy.
@param {object} c optional execution context for f.
@param {object} owner Owner object passed when clone is iterating an object.
    Used to set up context for cloned functions.
@param {object} cloned hash of previously cloned objects to avoid multiple
    clones.
@return {Array|Object} the cloned object.
**/
Y.clone = function(o, safe, f, c, owner, cloned) {
    var o2, marked, stamp;

    // Does not attempt to clone:
    //
    // * Non-typeof-object values, "primitive" values don't need cloning.
    //
    // * YUI instances, cloning complex object like YUI instances is not
    //   advised, this is like cloning the world.
    //
    // * DOM nodes (#2528250), common host objects like DOM nodes cannot be
    //   "subclassed" in Firefox and old versions of IE. Trying to use
    //   `Object.create()` or `Y.extend()` on a DOM node will throw an error in
    //   these browsers.
    //
    // Instad, the passed-in `o` will be return as-is when it matches one of the
    // above criteria.
    if (!L.isObject(o) ||
            Y.instanceOf(o, YUI) ||
            (o.addEventListener || o.attachEvent)) {

        return o;
    }

    marked = cloned || {};

    switch (L.type(o)) {
        case 'date':
            return new Date(o);
        case 'regexp':
            // if we do this we need to set the flags too
            // return new RegExp(o.source);
            return o;
        case 'function':
            // o2 = Y.bind(o, owner);
            // break;
            return o;
        case 'array':
            o2 = [];
            break;
        default:

            // #2528250 only one clone of a given object should be created.
            if (o[CLONE_MARKER]) {
                return marked[o[CLONE_MARKER]];
            }

            stamp = Y.guid();

            o2 = (safe) ? {} : Y.Object(o);

            o[CLONE_MARKER] = stamp;
            marked[stamp] = o;
    }

    Y.each(o, function(v, k) {
        if ((k || k === 0) && (!f || (f.call(c || this, v, k, this, o) !== false))) {
            if (k !== CLONE_MARKER) {
                if (k == 'prototype') {
                    // skip the prototype
                // } else if (o[k] === o) {
                //     this[k] = this;
                } else {
                    this[k] =
                        Y.clone(v, safe, f, c, owner || o, marked);
                }
            }
        }
    }, o2);

    if (!cloned) {
        Y.Object.each(marked, function(v, k) {
            if (v[CLONE_MARKER]) {
                try {
                    delete v[CLONE_MARKER];
                } catch (e) {
                    v[CLONE_MARKER] = null;
                }
            }
        }, this);
        marked = null;
    }

    return o2;
};

/**
 * Returns a function that will execute the supplied function in the
 * supplied object's context, optionally adding any additional
 * supplied parameters to the beginning of the arguments collection the
 * supplied to the function.
 *
 * @method bind
 * @param {Function|String} f the function to bind, or a function name
 * to execute on the context object.
 * @param {object} c the execution context.
 * @param {any} args* 0..n arguments to include before the arguments the
 * function is executed with.
 * @return {function} the wrapped function.
 */
Y.bind = function(f, c) {
    var xargs = arguments.length > 2 ?
            Y.Array(arguments, 2, true) : null;
    return function() {
        var fn = L.isString(f) ? c[f] : f,
            args = (xargs) ?
                xargs.concat(Y.Array(arguments, 0, true)) : arguments;
        return fn.apply(c || fn, args);
    };
};

/**
 * Returns a function that will execute the supplied function in the
 * supplied object's context, optionally adding any additional
 * supplied parameters to the end of the arguments the function
 * is executed with.
 *
 * @method rbind
 * @param {Function|String} f the function to bind, or a function name
 * to execute on the context object.
 * @param {object} c the execution context.
 * @param {any} args* 0..n arguments to append to the end of
 * arguments collection supplied to the function.
 * @return {function} the wrapped function.
 */
Y.rbind = function(f, c) {
    var xargs = arguments.length > 2 ? Y.Array(arguments, 2, true) : null;
    return function() {
        var fn = L.isString(f) ? c[f] : f,
            args = (xargs) ?
                Y.Array(arguments, 0, true).concat(xargs) : arguments;
        return fn.apply(c || fn, args);
    };
};


}, '3.17.1', {"requires": ["yui-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-custom-base', function (Y, NAME) {

/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event-custom
 */

Y.Env.evt = {
    handles: {},
    plugins: {}
};

/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event-custom
 * @submodule event-custom-base
 */

/**
 * Allows for the insertion of methods that are executed before or after
 * a specified method
 * @class Do
 * @static
 */

var DO_BEFORE = 0,
    DO_AFTER = 1,

DO = {

    /**
     * Cache of objects touched by the utility
     * @property objs
     * @static
     * @deprecated Since 3.6.0. The `_yuiaop` property on the AOP'd object
     * replaces the role of this property, but is considered to be private, and
     * is only mentioned to provide a migration path.
     *
     * If you have a use case which warrants migration to the _yuiaop property,
     * please file a ticket to let us know what it's used for and we can see if
     * we need to expose hooks for that functionality more formally.
     */
    objs: null,

    /**
     * <p>Execute the supplied method before the specified function.  Wrapping
     * function may optionally return an instance of the following classes to
     * further alter runtime behavior:</p>
     * <dl>
     *     <dt></code>Y.Do.Halt(message, returnValue)</code></dt>
     *         <dd>Immediatly stop execution and return
     *         <code>returnValue</code>.  No other wrapping functions will be
     *         executed.</dd>
     *     <dt></code>Y.Do.AlterArgs(message, newArgArray)</code></dt>
     *         <dd>Replace the arguments that the original function will be
     *         called with.</dd>
     *     <dt></code>Y.Do.Prevent(message)</code></dt>
     *         <dd>Don't execute the wrapped function.  Other before phase
     *         wrappers will be executed.</dd>
     * </dl>
     *
     * @method before
     * @param fn {Function} the function to execute
     * @param obj the object hosting the method to displace
     * @param sFn {string} the name of the method to displace
     * @param c The execution context for fn
     * @param arg* {mixed} 0..n additional arguments to supply to the subscriber
     * when the event fires.
     * @return {EventHandle} handle for the subscription
     * @static
     */
    before: function(fn, obj, sFn, c) {
        var f = fn, a;
        if (c) {
            a = [fn, c].concat(Y.Array(arguments, 4, true));
            f = Y.rbind.apply(Y, a);
        }

        return this._inject(DO_BEFORE, f, obj, sFn);
    },

    /**
     * <p>Execute the supplied method after the specified function.  Wrapping
     * function may optionally return an instance of the following classes to
     * further alter runtime behavior:</p>
     * <dl>
     *     <dt></code>Y.Do.Halt(message, returnValue)</code></dt>
     *         <dd>Immediatly stop execution and return
     *         <code>returnValue</code>.  No other wrapping functions will be
     *         executed.</dd>
     *     <dt></code>Y.Do.AlterReturn(message, returnValue)</code></dt>
     *         <dd>Return <code>returnValue</code> instead of the wrapped
     *         method's original return value.  This can be further altered by
     *         other after phase wrappers.</dd>
     * </dl>
     *
     * <p>The static properties <code>Y.Do.originalRetVal</code> and
     * <code>Y.Do.currentRetVal</code> will be populated for reference.</p>
     *
     * @method after
     * @param fn {Function} the function to execute
     * @param obj the object hosting the method to displace
     * @param sFn {string} the name of the method to displace
     * @param c The execution context for fn
     * @param arg* {mixed} 0..n additional arguments to supply to the subscriber
     * @return {EventHandle} handle for the subscription
     * @static
     */
    after: function(fn, obj, sFn, c) {
        var f = fn, a;
        if (c) {
            a = [fn, c].concat(Y.Array(arguments, 4, true));
            f = Y.rbind.apply(Y, a);
        }

        return this._inject(DO_AFTER, f, obj, sFn);
    },

    /**
     * Execute the supplied method before or after the specified function.
     * Used by <code>before</code> and <code>after</code>.
     *
     * @method _inject
     * @param when {string} before or after
     * @param fn {Function} the function to execute
     * @param obj the object hosting the method to displace
     * @param sFn {string} the name of the method to displace
     * @param c The execution context for fn
     * @return {EventHandle} handle for the subscription
     * @private
     * @static
     */
    _inject: function(when, fn, obj, sFn) {
        // object id
        var id = Y.stamp(obj), o, sid;

        if (!obj._yuiaop) {
            // create a map entry for the obj if it doesn't exist, to hold overridden methods
            obj._yuiaop = {};
        }

        o = obj._yuiaop;

        if (!o[sFn]) {
            // create a map entry for the method if it doesn't exist
            o[sFn] = new Y.Do.Method(obj, sFn);

            // re-route the method to our wrapper
            obj[sFn] = function() {
                return o[sFn].exec.apply(o[sFn], arguments);
            };
        }

        // subscriber id
        sid = id + Y.stamp(fn) + sFn;

        // register the callback
        o[sFn].register(sid, fn, when);

        return new Y.EventHandle(o[sFn], sid);
    },

    /**
     * Detach a before or after subscription.
     *
     * @method detach
     * @param handle {EventHandle} the subscription handle
     * @static
     */
    detach: function(handle) {
        if (handle.detach) {
            handle.detach();
        }
    }
};

Y.Do = DO;

//////////////////////////////////////////////////////////////////////////

/**
 * Contains the return value from the wrapped method, accessible
 * by 'after' event listeners.
 *
 * @property originalRetVal
 * @static
 * @since 3.2.0
 */

/**
 * Contains the current state of the return value, consumable by
 * 'after' event listeners, and updated if an after subscriber
 * changes the return value generated by the wrapped function.
 *
 * @property currentRetVal
 * @static
 * @since 3.2.0
 */

//////////////////////////////////////////////////////////////////////////

/**
 * Wrapper for a displaced method with aop enabled
 * @class Do.Method
 * @constructor
 * @param obj The object to operate on
 * @param sFn The name of the method to displace
 */
DO.Method = function(obj, sFn) {
    this.obj = obj;
    this.methodName = sFn;
    this.method = obj[sFn];
    this.before = {};
    this.after = {};
};

/**
 * Register a aop subscriber
 * @method register
 * @param sid {string} the subscriber id
 * @param fn {Function} the function to execute
 * @param when {string} when to execute the function
 */
DO.Method.prototype.register = function (sid, fn, when) {
    if (when) {
        this.after[sid] = fn;
    } else {
        this.before[sid] = fn;
    }
};

/**
 * Unregister a aop subscriber
 * @method delete
 * @param sid {string} the subscriber id
 * @param fn {Function} the function to execute
 * @param when {string} when to execute the function
 */
DO.Method.prototype._delete = function (sid) {
    delete this.before[sid];
    delete this.after[sid];
};

/**
 * <p>Execute the wrapped method.  All arguments are passed into the wrapping
 * functions.  If any of the before wrappers return an instance of
 * <code>Y.Do.Halt</code> or <code>Y.Do.Prevent</code>, neither the wrapped
 * function nor any after phase subscribers will be executed.</p>
 *
 * <p>The return value will be the return value of the wrapped function or one
 * provided by a wrapper function via an instance of <code>Y.Do.Halt</code> or
 * <code>Y.Do.AlterReturn</code>.
 *
 * @method exec
 * @param arg* {any} Arguments are passed to the wrapping and wrapped functions
 * @return {any} Return value of wrapped function unless overwritten (see above)
 */
DO.Method.prototype.exec = function () {

    var args = Y.Array(arguments, 0, true),
        i, ret, newRet,
        bf = this.before,
        af = this.after,
        prevented = false;

    // execute before
    for (i in bf) {
        if (bf.hasOwnProperty(i)) {
            ret = bf[i].apply(this.obj, args);
            if (ret) {
                switch (ret.constructor) {
                    case DO.Halt:
                        return ret.retVal;
                    case DO.AlterArgs:
                        args = ret.newArgs;
                        break;
                    case DO.Prevent:
                        prevented = true;
                        break;
                    default:
                }
            }
        }
    }

    // execute method
    if (!prevented) {
        ret = this.method.apply(this.obj, args);
    }

    DO.originalRetVal = ret;
    DO.currentRetVal = ret;

    // execute after methods.
    for (i in af) {
        if (af.hasOwnProperty(i)) {
            newRet = af[i].apply(this.obj, args);
            // Stop processing if a Halt object is returned
            if (newRet && newRet.constructor === DO.Halt) {
                return newRet.retVal;
            // Check for a new return value
            } else if (newRet && newRet.constructor === DO.AlterReturn) {
                ret = newRet.newRetVal;
                // Update the static retval state
                DO.currentRetVal = ret;
            }
        }
    }

    return ret;
};

//////////////////////////////////////////////////////////////////////////

/**
 * Return an AlterArgs object when you want to change the arguments that
 * were passed into the function.  Useful for Do.before subscribers.  An
 * example would be a service that scrubs out illegal characters prior to
 * executing the core business logic.
 * @class Do.AlterArgs
 * @constructor
 * @param msg {String} (optional) Explanation of the altered return value
 * @param newArgs {Array} Call parameters to be used for the original method
 *                        instead of the arguments originally passed in.
 */
DO.AlterArgs = function(msg, newArgs) {
    this.msg = msg;
    this.newArgs = newArgs;
};

/**
 * Return an AlterReturn object when you want to change the result returned
 * from the core method to the caller.  Useful for Do.after subscribers.
 * @class Do.AlterReturn
 * @constructor
 * @param msg {String} (optional) Explanation of the altered return value
 * @param newRetVal {any} Return value passed to code that invoked the wrapped
 *                      function.
 */
DO.AlterReturn = function(msg, newRetVal) {
    this.msg = msg;
    this.newRetVal = newRetVal;
};

/**
 * Return a Halt object when you want to terminate the execution
 * of all subsequent subscribers as well as the wrapped method
 * if it has not exectued yet.  Useful for Do.before subscribers.
 * @class Do.Halt
 * @constructor
 * @param msg {String} (optional) Explanation of why the termination was done
 * @param retVal {any} Return value passed to code that invoked the wrapped
 *                      function.
 */
DO.Halt = function(msg, retVal) {
    this.msg = msg;
    this.retVal = retVal;
};

/**
 * Return a Prevent object when you want to prevent the wrapped function
 * from executing, but want the remaining listeners to execute.  Useful
 * for Do.before subscribers.
 * @class Do.Prevent
 * @constructor
 * @param msg {String} (optional) Explanation of why the termination was done
 */
DO.Prevent = function(msg) {
    this.msg = msg;
};

/**
 * Return an Error object when you want to terminate the execution
 * of all subsequent method calls.
 * @class Do.Error
 * @constructor
 * @param msg {String} (optional) Explanation of the altered return value
 * @param retVal {any} Return value passed to code that invoked the wrapped
 *                      function.
 * @deprecated use Y.Do.Halt or Y.Do.Prevent
 */
DO.Error = DO.Halt;


//////////////////////////////////////////////////////////////////////////

/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event-custom
 * @submodule event-custom-base
 */


// var onsubscribeType = "_event:onsub",
var YArray = Y.Array,

    AFTER = 'after',
    CONFIGS = [
        'broadcast',
        'monitored',
        'bubbles',
        'context',
        'contextFn',
        'currentTarget',
        'defaultFn',
        'defaultTargetOnly',
        'details',
        'emitFacade',
        'fireOnce',
        'async',
        'host',
        'preventable',
        'preventedFn',
        'queuable',
        'silent',
        'stoppedFn',
        'target',
        'type'
    ],

    CONFIGS_HASH = YArray.hash(CONFIGS),

    nativeSlice = Array.prototype.slice,

    YUI3_SIGNATURE = 9,
    YUI_LOG = 'yui:log',

    mixConfigs = function(r, s, ov) {
        var p;

        for (p in s) {
            if (CONFIGS_HASH[p] && (ov || !(p in r))) {
                r[p] = s[p];
            }
        }

        return r;
    };

/**
 * The CustomEvent class lets you define events for your application
 * that can be subscribed to by one or more independent component.
 *
 * @param {String} type The type of event, which is passed to the callback
 * when the event fires.
 * @param {object} defaults configuration object.
 * @class CustomEvent
 * @constructor
 */

 /**
 * The type of event, returned to subscribers when the event fires
 * @property type
 * @type string
 */

/**
 * By default all custom events are logged in the debug build, set silent
 * to true to disable debug outpu for this event.
 * @property silent
 * @type boolean
 */

Y.CustomEvent = function(type, defaults) {

    this._kds = Y.CustomEvent.keepDeprecatedSubs;

    this.id = Y.guid();

    this.type = type;
    this.silent = this.logSystem = (type === YUI_LOG);

    if (this._kds) {
        /**
         * The subscribers to this event
         * @property subscribers
         * @type Subscriber {}
         * @deprecated
         */

        /**
         * 'After' subscribers
         * @property afters
         * @type Subscriber {}
         * @deprecated
         */
        this.subscribers = {};
        this.afters = {};
    }

    if (defaults) {
        mixConfigs(this, defaults, true);
    }
};

/**
 * Static flag to enable population of the <a href="#property_subscribers">`subscribers`</a>
 * and  <a href="#property_subscribers">`afters`</a> properties held on a `CustomEvent` instance.
 *
 * These properties were changed to private properties (`_subscribers` and `_afters`), and
 * converted from objects to arrays for performance reasons.
 *
 * Setting this property to true will populate the deprecated `subscribers` and `afters`
 * properties for people who may be using them (which is expected to be rare). There will
 * be a performance hit, compared to the new array based implementation.
 *
 * If you are using these deprecated properties for a use case which the public API
 * does not support, please file an enhancement request, and we can provide an alternate
 * public implementation which doesn't have the performance cost required to maintiain the
 * properties as objects.
 *
 * @property keepDeprecatedSubs
 * @static
 * @for CustomEvent
 * @type boolean
 * @default false
 * @deprecated
 */
Y.CustomEvent.keepDeprecatedSubs = false;

Y.CustomEvent.mixConfigs = mixConfigs;

Y.CustomEvent.prototype = {

    constructor: Y.CustomEvent,

    /**
     * Monitor when an event is attached or detached.
     *
     * @property monitored
     * @type boolean
     */

    /**
     * If 0, this event does not broadcast.  If 1, the YUI instance is notified
     * every time this event fires.  If 2, the YUI instance and the YUI global
     * (if event is enabled on the global) are notified every time this event
     * fires.
     * @property broadcast
     * @type int
     */

    /**
     * Specifies whether this event should be queued when the host is actively
     * processing an event.  This will effect exectution order of the callbacks
     * for the various events.
     * @property queuable
     * @type boolean
     * @default false
     */

    /**
     * This event has fired if true
     *
     * @property fired
     * @type boolean
     * @default false;
     */

    /**
     * An array containing the arguments the custom event
     * was last fired with.
     * @property firedWith
     * @type Array
     */

    /**
     * This event should only fire one time if true, and if
     * it has fired, any new subscribers should be notified
     * immediately.
     *
     * @property fireOnce
     * @type boolean
     * @default false;
     */

    /**
     * fireOnce listeners will fire syncronously unless async
     * is set to true
     * @property async
     * @type boolean
     * @default false
     */

    /**
     * Flag for stopPropagation that is modified during fire()
     * 1 means to stop propagation to bubble targets.  2 means
     * to also stop additional subscribers on this target.
     * @property stopped
     * @type int
     */

    /**
     * Flag for preventDefault that is modified during fire().
     * if it is not 0, the default behavior for this event
     * @property prevented
     * @type int
     */

    /**
     * Specifies the host for this custom event.  This is used
     * to enable event bubbling
     * @property host
     * @type EventTarget
     */

    /**
     * The default function to execute after event listeners
     * have fire, but only if the default action was not
     * prevented.
     * @property defaultFn
     * @type Function
     */

    /**
     * Flag for the default function to execute only if the
     * firing event is the current target. This happens only
     * when using custom event delegation and setting the
     * flag to `true` mimics the behavior of event delegation
     * in the DOM.
     *
     * @property defaultTargetOnly
     * @type Boolean
     * @default false
     */

    /**
     * The function to execute if a subscriber calls
     * stopPropagation or stopImmediatePropagation
     * @property stoppedFn
     * @type Function
     */

    /**
     * The function to execute if a subscriber calls
     * preventDefault
     * @property preventedFn
     * @type Function
     */

    /**
     * The subscribers to this event
     * @property _subscribers
     * @type Subscriber []
     * @private
     */

    /**
     * 'After' subscribers
     * @property _afters
     * @type Subscriber []
     * @private
     */

    /**
     * If set to true, the custom event will deliver an EventFacade object
     * that is similar to a DOM event object.
     * @property emitFacade
     * @type boolean
     * @default false
     */

    /**
     * Supports multiple options for listener signatures in order to
     * port YUI 2 apps.
     * @property signature
     * @type int
     * @default 9
     */
    signature : YUI3_SIGNATURE,

    /**
     * The context the the event will fire from by default.  Defaults to the YUI
     * instance.
     * @property context
     * @type object
     */
    context : Y,

    /**
     * Specifies whether or not this event's default function
     * can be cancelled by a subscriber by executing preventDefault()
     * on the event facade
     * @property preventable
     * @type boolean
     * @default true
     */
    preventable : true,

    /**
     * Specifies whether or not a subscriber can stop the event propagation
     * via stopPropagation(), stopImmediatePropagation(), or halt()
     *
     * Events can only bubble if emitFacade is true.
     *
     * @property bubbles
     * @type boolean
     * @default true
     */
    bubbles : true,

    /**
     * Returns the number of subscribers for this event as the sum of the on()
     * subscribers and after() subscribers.
     *
     * @method hasSubs
     * @return Number
     */
    hasSubs: function(when) {
        var s = 0,
            a = 0,
            subs = this._subscribers,
            afters = this._afters,
            sib = this.sibling;

        if (subs) {
            s = subs.length;
        }

        if (afters) {
            a = afters.length;
        }

        if (sib) {
            subs = sib._subscribers;
            afters = sib._afters;

            if (subs) {
                s += subs.length;
            }

            if (afters) {
                a += afters.length;
            }
        }

        if (when) {
            return (when === 'after') ? a : s;
        }

        return (s + a);
    },

    /**
     * Monitor the event state for the subscribed event.  The first parameter
     * is what should be monitored, the rest are the normal parameters when
     * subscribing to an event.
     * @method monitor
     * @param what {string} what to monitor ('detach', 'attach', 'publish').
     * @return {EventHandle} return value from the monitor event subscription.
     */
    monitor: function(what) {
        this.monitored = true;
        var type = this.id + '|' + this.type + '_' + what,
            args = nativeSlice.call(arguments, 0);
        args[0] = type;
        return this.host.on.apply(this.host, args);
    },

    /**
     * Get all of the subscribers to this event and any sibling event
     * @method getSubs
     * @return {Array} first item is the on subscribers, second the after.
     */
    getSubs: function() {

        var sibling = this.sibling,
            subs = this._subscribers,
            afters = this._afters,
            siblingSubs,
            siblingAfters;

        if (sibling) {
            siblingSubs = sibling._subscribers;
            siblingAfters = sibling._afters;
        }

        if (siblingSubs) {
            if (subs) {
                subs = subs.concat(siblingSubs);
            } else {
                subs = siblingSubs.concat();
            }
        } else {
            if (subs) {
                subs = subs.concat();
            } else {
                subs = [];
            }
        }

        if (siblingAfters) {
            if (afters) {
                afters = afters.concat(siblingAfters);
            } else {
                afters = siblingAfters.concat();
            }
        } else {
            if (afters) {
                afters = afters.concat();
            } else {
                afters = [];
            }
        }

        return [subs, afters];
    },

    /**
     * Apply configuration properties.  Only applies the CONFIG whitelist
     * @method applyConfig
     * @param o hash of properties to apply.
     * @param force {boolean} if true, properties that exist on the event
     * will be overwritten.
     */
    applyConfig: function(o, force) {
        mixConfigs(this, o, force);
    },

    /**
     * Create the Subscription for subscribing function, context, and bound
     * arguments.  If this is a fireOnce event, the subscriber is immediately
     * notified.
     *
     * @method _on
     * @param fn {Function} Subscription callback
     * @param [context] {Object} Override `this` in the callback
     * @param [args] {Array} bound arguments that will be passed to the callback after the arguments generated by fire()
     * @param [when] {String} "after" to slot into after subscribers
     * @return {EventHandle}
     * @protected
     */
    _on: function(fn, context, args, when) {


        var s = new Y.Subscriber(fn, context, args, when),
            firedWith;

        if (this.fireOnce && this.fired) {

            firedWith = this.firedWith;

            // It's a little ugly for this to know about facades,
            // but given the current breakup, not much choice without
            // moving a whole lot of stuff around.
            if (this.emitFacade && this._addFacadeToArgs) {
                this._addFacadeToArgs(firedWith);
            }

            if (this.async) {
                setTimeout(Y.bind(this._notify, this, s, firedWith), 0);
            } else {
                this._notify(s, firedWith);
            }
        }

        if (when === AFTER) {
            if (!this._afters) {
                this._afters = [];
            }
            this._afters.push(s);
        } else {
            if (!this._subscribers) {
                this._subscribers = [];
            }
            this._subscribers.push(s);
        }

        if (this._kds) {
            if (when === AFTER) {
                this.afters[s.id] = s;
            } else {
                this.subscribers[s.id] = s;
            }
        }

        return new Y.EventHandle(this, s);
    },

    /**
     * Listen for this event
     * @method subscribe
     * @param {Function} fn The function to execute.
     * @return {EventHandle} Unsubscribe handle.
     * @deprecated use on.
     */
    subscribe: function(fn, context) {
        var a = (arguments.length > 2) ? nativeSlice.call(arguments, 2) : null;
        return this._on(fn, context, a, true);
    },

    /**
     * Listen for this event
     * @method on
     * @param {Function} fn The function to execute.
     * @param {object} context optional execution context.
     * @param {mixed} arg* 0..n additional arguments to supply to the subscriber
     * when the event fires.
     * @return {EventHandle} An object with a detach method to detch the handler(s).
     */
    on: function(fn, context) {
        var a = (arguments.length > 2) ? nativeSlice.call(arguments, 2) : null;

        if (this.monitored && this.host) {
            this.host._monitor('attach', this, {
                args: arguments
            });
        }
        return this._on(fn, context, a, true);
    },

    /**
     * Listen for this event after the normal subscribers have been notified and
     * the default behavior has been applied.  If a normal subscriber prevents the
     * default behavior, it also prevents after listeners from firing.
     * @method after
     * @param {Function} fn The function to execute.
     * @param {object} context optional execution context.
     * @param {mixed} arg* 0..n additional arguments to supply to the subscriber
     * when the event fires.
     * @return {EventHandle} handle Unsubscribe handle.
     */
    after: function(fn, context) {
        var a = (arguments.length > 2) ? nativeSlice.call(arguments, 2) : null;
        return this._on(fn, context, a, AFTER);
    },

    /**
     * Detach listeners.
     * @method detach
     * @param {Function} fn  The subscribed function to remove, if not supplied
     *                       all will be removed.
     * @param {Object}   context The context object passed to subscribe.
     * @return {Number} returns the number of subscribers unsubscribed.
     */
    detach: function(fn, context) {
        // unsubscribe handle
        if (fn && fn.detach) {
            return fn.detach();
        }

        var i, s,
            found = 0,
            subs = this._subscribers,
            afters = this._afters;

        if (subs) {
            for (i = subs.length; i >= 0; i--) {
                s = subs[i];
                if (s && (!fn || fn === s.fn)) {
                    this._delete(s, subs, i);
                    found++;
                }
            }
        }

        if (afters) {
            for (i = afters.length; i >= 0; i--) {
                s = afters[i];
                if (s && (!fn || fn === s.fn)) {
                    this._delete(s, afters, i);
                    found++;
                }
            }
        }

        return found;
    },

    /**
     * Detach listeners.
     * @method unsubscribe
     * @param {Function} fn  The subscribed function to remove, if not supplied
     *                       all will be removed.
     * @param {Object}   context The context object passed to subscribe.
     * @return {int|undefined} returns the number of subscribers unsubscribed.
     * @deprecated use detach.
     */
    unsubscribe: function() {
        return this.detach.apply(this, arguments);
    },

    /**
     * Notify a single subscriber
     * @method _notify
     * @param {Subscriber} s the subscriber.
     * @param {Array} args the arguments array to apply to the listener.
     * @protected
     */
    _notify: function(s, args, ef) {


        var ret;

        ret = s.notify(args, this);

        if (false === ret || this.stopped > 1) {
            return false;
        }

        return true;
    },

    /**
     * Logger abstraction to centralize the application of the silent flag
     * @method log
     * @param {string} msg message to log.
     * @param {string} cat log category.
     */
    log: function(msg, cat) {
    },

    /**
     * Notifies the subscribers.  The callback functions will be executed
     * from the context specified when the event was created, and with the
     * following parameters:
     *   <ul>
     *   <li>The type of event</li>
     *   <li>All of the arguments fire() was executed with as an array</li>
     *   <li>The custom object (if any) that was passed into the subscribe()
     *       method</li>
     *   </ul>
     * @method fire
     * @param {Object*} arguments an arbitrary set of parameters to pass to
     *                            the handler.
     * @return {boolean} false if one of the subscribers returned false,
     *                   true otherwise.
     *
     */
    fire: function() {

        // push is the fastest way to go from arguments to arrays
        // for most browsers currently
        // http://jsperf.com/push-vs-concat-vs-slice/2

        var args = [];
        args.push.apply(args, arguments);

        return this._fire(args);
    },

    /**
     * Private internal implementation for `fire`, which is can be used directly by
     * `EventTarget` and other event module classes which have already converted from
     * an `arguments` list to an array, to avoid the repeated overhead.
     *
     * @method _fire
     * @private
     * @param {Array} args The array of arguments passed to be passed to handlers.
     * @return {boolean} false if one of the subscribers returned false, true otherwise.
     */
    _fire: function(args) {

        if (this.fireOnce && this.fired) {
            return true;
        } else {

            // this doesn't happen if the event isn't published
            // this.host._monitor('fire', this.type, args);

            this.fired = true;

            if (this.fireOnce) {
                this.firedWith = args;
            }

            if (this.emitFacade) {
                return this.fireComplex(args);
            } else {
                return this.fireSimple(args);
            }
        }
    },

    /**
     * Set up for notifying subscribers of non-emitFacade events.
     *
     * @method fireSimple
     * @param args {Array} Arguments passed to fire()
     * @return Boolean false if a subscriber returned false
     * @protected
     */
    fireSimple: function(args) {
        this.stopped = 0;
        this.prevented = 0;
        if (this.hasSubs()) {
            var subs = this.getSubs();
            this._procSubs(subs[0], args);
            this._procSubs(subs[1], args);
        }
        if (this.broadcast) {
            this._broadcast(args);
        }
        return this.stopped ? false : true;
    },

    // Requires the event-custom-complex module for full funcitonality.
    fireComplex: function(args) {
        args[0] = args[0] || {};
        return this.fireSimple(args);
    },

    /**
     * Notifies a list of subscribers.
     *
     * @method _procSubs
     * @param subs {Array} List of subscribers
     * @param args {Array} Arguments passed to fire()
     * @param ef {}
     * @return Boolean false if a subscriber returns false or stops the event
     *              propagation via e.stopPropagation(),
     *              e.stopImmediatePropagation(), or e.halt()
     * @private
     */
    _procSubs: function(subs, args, ef) {
        var s, i, l;

        for (i = 0, l = subs.length; i < l; i++) {
            s = subs[i];
            if (s && s.fn) {
                if (false === this._notify(s, args, ef)) {
                    this.stopped = 2;
                }
                if (this.stopped === 2) {
                    return false;
                }
            }
        }

        return true;
    },

    /**
     * Notifies the YUI instance if the event is configured with broadcast = 1,
     * and both the YUI instance and Y.Global if configured with broadcast = 2.
     *
     * @method _broadcast
     * @param args {Array} Arguments sent to fire()
     * @private
     */
    _broadcast: function(args) {
        if (!this.stopped && this.broadcast) {

            var a = args.concat();
            a.unshift(this.type);

            if (this.host !== Y) {
                Y.fire.apply(Y, a);
            }

            if (this.broadcast === 2) {
                Y.Global.fire.apply(Y.Global, a);
            }
        }
    },

    /**
     * Removes all listeners
     * @method unsubscribeAll
     * @return {Number} The number of listeners unsubscribed.
     * @deprecated use detachAll.
     */
    unsubscribeAll: function() {
        return this.detachAll.apply(this, arguments);
    },

    /**
     * Removes all listeners
     * @method detachAll
     * @return {Number} The number of listeners unsubscribed.
     */
    detachAll: function() {
        return this.detach();
    },

    /**
     * Deletes the subscriber from the internal store of on() and after()
     * subscribers.
     *
     * @method _delete
     * @param s subscriber object.
     * @param subs (optional) on or after subscriber array
     * @param index (optional) The index found.
     * @private
     */
    _delete: function(s, subs, i) {
        var when = s._when;

        if (!subs) {
            subs = (when === AFTER) ? this._afters : this._subscribers;
        }

        if (subs) {
            i = YArray.indexOf(subs, s, 0);

            if (s && subs[i] === s) {
                subs.splice(i, 1);
            }
        }

        if (this._kds) {
            if (when === AFTER) {
                delete this.afters[s.id];
            } else {
                delete this.subscribers[s.id];
            }
        }

        if (this.monitored && this.host) {
            this.host._monitor('detach', this, {
                ce: this,
                sub: s
            });
        }

        if (s) {
            s.deleted = true;
        }
    }
};
/**
 * Stores the subscriber information to be used when the event fires.
 * @param {Function} fn       The wrapped function to execute.
 * @param {Object}   context  The value of the keyword 'this' in the listener.
 * @param {Array} args*       0..n additional arguments to supply the listener.
 *
 * @class Subscriber
 * @constructor
 */
Y.Subscriber = function(fn, context, args, when) {

    /**
     * The callback that will be execute when the event fires
     * This is wrapped by Y.rbind if obj was supplied.
     * @property fn
     * @type Function
     */
    this.fn = fn;

    /**
     * Optional 'this' keyword for the listener
     * @property context
     * @type Object
     */
    this.context = context;

    /**
     * Unique subscriber id
     * @property id
     * @type String
     */
    this.id = Y.guid();

    /**
     * Additional arguments to propagate to the subscriber
     * @property args
     * @type Array
     */
    this.args = args;

    this._when = when;

    /**
     * Custom events for a given fire transaction.
     * @property events
     * @type {EventTarget}
     */
    // this.events = null;

    /**
     * This listener only reacts to the event once
     * @property once
     */
    // this.once = false;

};

Y.Subscriber.prototype = {
    constructor: Y.Subscriber,

    _notify: function(c, args, ce) {
        if (this.deleted && !this.postponed) {
            if (this.postponed) {
                delete this.fn;
                delete this.context;
            } else {
                delete this.postponed;
                return null;
            }
        }
        var a = this.args, ret;
        switch (ce.signature) {
            case 0:
                ret = this.fn.call(c, ce.type, args, c);
                break;
            case 1:
                ret = this.fn.call(c, args[0] || null, c);
                break;
            default:
                if (a || args) {
                    args = args || [];
                    a = (a) ? args.concat(a) : args;
                    ret = this.fn.apply(c, a);
                } else {
                    ret = this.fn.call(c);
                }
        }

        if (this.once) {
            ce._delete(this);
        }

        return ret;
    },

    /**
     * Executes the subscriber.
     * @method notify
     * @param args {Array} Arguments array for the subscriber.
     * @param ce {CustomEvent} The custom event that sent the notification.
     */
    notify: function(args, ce) {
        var c = this.context,
            ret = true;

        if (!c) {
            c = (ce.contextFn) ? ce.contextFn() : ce.context;
        }

        // only catch errors if we will not re-throw them.
        if (Y.config && Y.config.throwFail) {
            ret = this._notify(c, args, ce);
        } else {
            try {
                ret = this._notify(c, args, ce);
            } catch (e) {
                Y.error(this + ' failed: ' + e.message, e);
            }
        }

        return ret;
    },

    /**
     * Returns true if the fn and obj match this objects properties.
     * Used by the unsubscribe method to match the right subscriber.
     *
     * @method contains
     * @param {Function} fn the function to execute.
     * @param {Object} context optional 'this' keyword for the listener.
     * @return {boolean} true if the supplied arguments match this
     *                   subscriber's signature.
     */
    contains: function(fn, context) {
        if (context) {
            return ((this.fn === fn) && this.context === context);
        } else {
            return (this.fn === fn);
        }
    },

    valueOf : function() {
        return this.id;
    }

};
/**
 * Return value from all subscribe operations
 * @class EventHandle
 * @constructor
 * @param {CustomEvent} evt the custom event.
 * @param {Subscriber} sub the subscriber.
 */
Y.EventHandle = function(evt, sub) {

    /**
     * The custom event
     *
     * @property evt
     * @type CustomEvent
     */
    this.evt = evt;

    /**
     * The subscriber object
     *
     * @property sub
     * @type Subscriber
     */
    this.sub = sub;
};

Y.EventHandle.prototype = {
    batch: function(f, c) {
        f.call(c || this, this);
        if (Y.Lang.isArray(this.evt)) {
            Y.Array.each(this.evt, function(h) {
                h.batch.call(c || h, f);
            });
        }
    },

    /**
     * Detaches this subscriber
     * @method detach
     * @return {Number} the number of detached listeners
     */
    detach: function() {
        var evt = this.evt, detached = 0, i;
        if (evt) {
            if (Y.Lang.isArray(evt)) {
                for (i = 0; i < evt.length; i++) {
                    detached += evt[i].detach();
                }
            } else {
                evt._delete(this.sub);
                detached = 1;
            }

        }

        return detached;
    },

    /**
     * Monitor the event state for the subscribed event.  The first parameter
     * is what should be monitored, the rest are the normal parameters when
     * subscribing to an event.
     * @method monitor
     * @param what {string} what to monitor ('attach', 'detach', 'publish').
     * @return {EventHandle} return value from the monitor event subscription.
     */
    monitor: function(what) {
        return this.evt.monitor.apply(this.evt, arguments);
    }
};

/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event-custom
 * @submodule event-custom-base
 */

/**
 * EventTarget provides the implementation for any object to
 * publish, subscribe and fire to custom events, and also
 * alows other EventTargets to target the object with events
 * sourced from the other object.
 * EventTarget is designed to be used with Y.augment to wrap
 * EventCustom in an interface that allows events to be listened to
 * and fired by name.  This makes it possible for implementing code to
 * subscribe to an event that either has not been created yet, or will
 * not be created at all.
 * @class EventTarget
 * @param opts a configuration object
 * @config emitFacade {boolean} if true, all events will emit event
 * facade payloads by default (default false)
 * @config prefix {String} the prefix to apply to non-prefixed event names
 */

var L = Y.Lang,
    PREFIX_DELIMITER = ':',
    CATEGORY_DELIMITER = '|',
    AFTER_PREFIX = '~AFTER~',
    WILD_TYPE_RE = /(.*?)(:)(.*?)/,

    _wildType = Y.cached(function(type) {
        return type.replace(WILD_TYPE_RE, "*$2$3");
    }),

    /**
     * If the instance has a prefix attribute and the
     * event type is not prefixed, the instance prefix is
     * applied to the supplied type.
     * @method _getType
     * @private
     */
    _getType = function(type, pre) {

        if (!pre || !type || type.indexOf(PREFIX_DELIMITER) > -1) {
            return type;
        }

        return pre + PREFIX_DELIMITER + type;
    },

    /**
     * Returns an array with the detach key (if provided),
     * and the prefixed event name from _getType
     * Y.on('detachcategory| menu:click', fn)
     * @method _parseType
     * @private
     */
    _parseType = Y.cached(function(type, pre) {

        var t = type, detachcategory, after, i;

        if (!L.isString(t)) {
            return t;
        }

        i = t.indexOf(AFTER_PREFIX);

        if (i > -1) {
            after = true;
            t = t.substr(AFTER_PREFIX.length);
        }

        i = t.indexOf(CATEGORY_DELIMITER);

        if (i > -1) {
            detachcategory = t.substr(0, (i));
            t = t.substr(i+1);
            if (t === '*') {
                t = null;
            }
        }

        // detach category, full type with instance prefix, is this an after listener, short type
        return [detachcategory, (pre) ? _getType(t, pre) : t, after, t];
    }),

    ET = function(opts) {

        var etState = this._yuievt,
            etConfig;

        if (!etState) {
            etState = this._yuievt = {
                events: {},    // PERF: Not much point instantiating lazily. We're bound to have events
                targets: null, // PERF: Instantiate lazily, if user actually adds target,
                config: {
                    host: this,
                    context: this
                },
                chain: Y.config.chain
            };
        }

        etConfig = etState.config;

        if (opts) {
            mixConfigs(etConfig, opts, true);

            if (opts.chain !== undefined) {
                etState.chain = opts.chain;
            }

            if (opts.prefix) {
                etConfig.prefix = opts.prefix;
            }
        }
    };

ET.prototype = {

    constructor: ET,

    /**
     * Listen to a custom event hosted by this object one time.
     * This is the equivalent to <code>on</code> except the
     * listener is immediatelly detached when it is executed.
     * @method once
     * @param {String} type The name of the event
     * @param {Function} fn The callback to execute in response to the event
     * @param {Object} [context] Override `this` object in callback
     * @param {Any} [arg*] 0..n additional arguments to supply to the subscriber
     * @return {EventHandle} A subscription handle capable of detaching the
     *                       subscription
     */
    once: function() {
        var handle = this.on.apply(this, arguments);
        handle.batch(function(hand) {
            if (hand.sub) {
                hand.sub.once = true;
            }
        });
        return handle;
    },

    /**
     * Listen to a custom event hosted by this object one time.
     * This is the equivalent to <code>after</code> except the
     * listener is immediatelly detached when it is executed.
     * @method onceAfter
     * @param {String} type The name of the event
     * @param {Function} fn The callback to execute in response to the event
     * @param {Object} [context] Override `this` object in callback
     * @param {Any} [arg*] 0..n additional arguments to supply to the subscriber
     * @return {EventHandle} A subscription handle capable of detaching that
     *                       subscription
     */
    onceAfter: function() {
        var handle = this.after.apply(this, arguments);
        handle.batch(function(hand) {
            if (hand.sub) {
                hand.sub.once = true;
            }
        });
        return handle;
    },

    /**
     * Takes the type parameter passed to 'on' and parses out the
     * various pieces that could be included in the type.  If the
     * event type is passed without a prefix, it will be expanded
     * to include the prefix one is supplied or the event target
     * is configured with a default prefix.
     * @method parseType
     * @param {String} type the type
     * @param {String} [pre] The prefix. Defaults to this._yuievt.config.prefix
     * @since 3.3.0
     * @return {Array} an array containing:
     *  * the detach category, if supplied,
     *  * the prefixed event type,
     *  * whether or not this is an after listener,
     *  * the supplied event type
     */
    parseType: function(type, pre) {
        return _parseType(type, pre || this._yuievt.config.prefix);
    },

    /**
     * Subscribe a callback function to a custom event fired by this object or
     * from an object that bubbles its events to this object.
     *
     * Callback functions for events published with `emitFacade = true` will
     * receive an `EventFacade` as the first argument (typically named "e").
     * These callbacks can then call `e.preventDefault()` to disable the
     * behavior published to that event's `defaultFn`.  See the `EventFacade`
     * API for all available properties and methods. Subscribers to
     * non-`emitFacade` events will receive the arguments passed to `fire()`
     * after the event name.
     *
     * To subscribe to multiple events at once, pass an object as the first
     * argument, where the key:value pairs correspond to the eventName:callback,
     * or pass an array of event names as the first argument to subscribe to
     * all listed events with the same callback.
     *
     * Returning `false` from a callback is supported as an alternative to
     * calling `e.preventDefault(); e.stopPropagation();`.  However, it is
     * recommended to use the event methods whenever possible.
     *
     * @method on
     * @param {String} type The name of the event
     * @param {Function} fn The callback to execute in response to the event
     * @param {Object} [context] Override `this` object in callback
     * @param {Any} [arg*] 0..n additional arguments to supply to the subscriber
     * @return {EventHandle} A subscription handle capable of detaching that
     *                       subscription
     */
    on: function(type, fn, context) {

        var yuievt = this._yuievt,
            parts = _parseType(type, yuievt.config.prefix), f, c, args, ret, ce,
            detachcategory, handle, store = Y.Env.evt.handles, after, adapt, shorttype,
            Node = Y.Node, n, domevent, isArr;

        // full name, args, detachcategory, after
        this._monitor('attach', parts[1], {
            args: arguments,
            category: parts[0],
            after: parts[2]
        });

        if (L.isObject(type)) {

            if (L.isFunction(type)) {
                return Y.Do.before.apply(Y.Do, arguments);
            }

            f = fn;
            c = context;
            args = nativeSlice.call(arguments, 0);
            ret = [];

            if (L.isArray(type)) {
                isArr = true;
            }

            after = type._after;
            delete type._after;

            Y.each(type, function(v, k) {

                if (L.isObject(v)) {
                    f = v.fn || ((L.isFunction(v)) ? v : f);
                    c = v.context || c;
                }

                var nv = (after) ? AFTER_PREFIX : '';

                args[0] = nv + ((isArr) ? v : k);
                args[1] = f;
                args[2] = c;

                ret.push(this.on.apply(this, args));

            }, this);

            return (yuievt.chain) ? this : new Y.EventHandle(ret);
        }

        detachcategory = parts[0];
        after = parts[2];
        shorttype = parts[3];

        // extra redirection so we catch adaptor events too.  take a look at this.
        if (Node && Y.instanceOf(this, Node) && (shorttype in Node.DOM_EVENTS)) {
            args = nativeSlice.call(arguments, 0);
            args.splice(2, 0, Node.getDOMNode(this));
            return Y.on.apply(Y, args);
        }

        type = parts[1];

        if (Y.instanceOf(this, YUI)) {

            adapt = Y.Env.evt.plugins[type];
            args  = nativeSlice.call(arguments, 0);
            args[0] = shorttype;

            if (Node) {
                n = args[2];

                if (Y.instanceOf(n, Y.NodeList)) {
                    n = Y.NodeList.getDOMNodes(n);
                } else if (Y.instanceOf(n, Node)) {
                    n = Node.getDOMNode(n);
                }

                domevent = (shorttype in Node.DOM_EVENTS);

                // Captures both DOM events and event plugins.
                if (domevent) {
                    args[2] = n;
                }
            }

            // check for the existance of an event adaptor
            if (adapt) {
                handle = adapt.on.apply(Y, args);
            } else if ((!type) || domevent) {
                handle = Y.Event._attach(args);
            }

        }

        if (!handle) {
            ce = yuievt.events[type] || this.publish(type);
            handle = ce._on(fn, context, (arguments.length > 3) ? nativeSlice.call(arguments, 3) : null, (after) ? 'after' : true);

            // TODO: More robust regex, accounting for category
            if (type.indexOf("*:") !== -1) {
                this._hasSiblings = true;
            }
        }

        if (detachcategory) {
            store[detachcategory] = store[detachcategory] || {};
            store[detachcategory][type] = store[detachcategory][type] || [];
            store[detachcategory][type].push(handle);
        }

        return (yuievt.chain) ? this : handle;

    },

    /**
     * subscribe to an event
     * @method subscribe
     * @deprecated use on
     */
    subscribe: function() {
        return this.on.apply(this, arguments);
    },

    /**
     * Detach one or more listeners the from the specified event
     * @method detach
     * @param type {string|Object}   Either the handle to the subscriber or the
     *                        type of event.  If the type
     *                        is not specified, it will attempt to remove
     *                        the listener from all hosted events.
     * @param fn   {Function} The subscribed function to unsubscribe, if not
     *                          supplied, all subscribers will be removed.
     * @param context  {Object}   The custom object passed to subscribe.  This is
     *                        optional, but if supplied will be used to
     *                        disambiguate multiple listeners that are the same
     *                        (e.g., you subscribe many object using a function
     *                        that lives on the prototype)
     * @return {EventTarget} the host
     */
    detach: function(type, fn, context) {

        var evts = this._yuievt.events,
            i,
            Node = Y.Node,
            isNode = Node && (Y.instanceOf(this, Node));

        // detachAll disabled on the Y instance.
        if (!type && (this !== Y)) {
            for (i in evts) {
                if (evts.hasOwnProperty(i)) {
                    evts[i].detach(fn, context);
                }
            }
            if (isNode) {
                Y.Event.purgeElement(Node.getDOMNode(this));
            }

            return this;
        }

        var parts = _parseType(type, this._yuievt.config.prefix),
        detachcategory = L.isArray(parts) ? parts[0] : null,
        shorttype = (parts) ? parts[3] : null,
        adapt, store = Y.Env.evt.handles, detachhost, cat, args,
        ce,

        keyDetacher = function(lcat, ltype, host) {
            var handles = lcat[ltype], ce, i;
            if (handles) {
                for (i = handles.length - 1; i >= 0; --i) {
                    ce = handles[i].evt;
                    if (ce.host === host || ce.el === host) {
                        handles[i].detach();
                    }
                }
            }
        };

        if (detachcategory) {

            cat = store[detachcategory];
            type = parts[1];
            detachhost = (isNode) ? Y.Node.getDOMNode(this) : this;

            if (cat) {
                if (type) {
                    keyDetacher(cat, type, detachhost);
                } else {
                    for (i in cat) {
                        if (cat.hasOwnProperty(i)) {
                            keyDetacher(cat, i, detachhost);
                        }
                    }
                }

                return this;
            }

        // If this is an event handle, use it to detach
        } else if (L.isObject(type) && type.detach) {
            type.detach();
            return this;
        // extra redirection so we catch adaptor events too.  take a look at this.
        } else if (isNode && ((!shorttype) || (shorttype in Node.DOM_EVENTS))) {
            args = nativeSlice.call(arguments, 0);
            args[2] = Node.getDOMNode(this);
            Y.detach.apply(Y, args);
            return this;
        }

        adapt = Y.Env.evt.plugins[shorttype];

        // The YUI instance handles DOM events and adaptors
        if (Y.instanceOf(this, YUI)) {
            args = nativeSlice.call(arguments, 0);
            // use the adaptor specific detach code if
            if (adapt && adapt.detach) {
                adapt.detach.apply(Y, args);
                return this;
            // DOM event fork
            } else if (!type || (!adapt && Node && (type in Node.DOM_EVENTS))) {
                args[0] = type;
                Y.Event.detach.apply(Y.Event, args);
                return this;
            }
        }

        // ce = evts[type];
        ce = evts[parts[1]];
        if (ce) {
            ce.detach(fn, context);
        }

        return this;
    },

    /**
     * detach a listener
     * @method unsubscribe
     * @deprecated use detach
     */
    unsubscribe: function() {
        return this.detach.apply(this, arguments);
    },

    /**
     * Removes all listeners from the specified event.  If the event type
     * is not specified, all listeners from all hosted custom events will
     * be removed.
     * @method detachAll
     * @param type {String}   The type, or name of the event
     */
    detachAll: function(type) {
        return this.detach(type);
    },

    /**
     * Removes all listeners from the specified event.  If the event type
     * is not specified, all listeners from all hosted custom events will
     * be removed.
     * @method unsubscribeAll
     * @param type {String}   The type, or name of the event
     * @deprecated use detachAll
     */
    unsubscribeAll: function() {
        return this.detachAll.apply(this, arguments);
    },

    /**
     * Creates a new custom event of the specified type.  If a custom event
     * by that name already exists, it will not be re-created.  In either
     * case the custom event is returned.
     *
     * @method publish
     *
     * @param type {String} the type, or name of the event
     * @param opts {object} optional config params.  Valid properties are:
     *
     *  <ul>
     *    <li>
     *   'broadcast': whether or not the YUI instance and YUI global are notified when the event is fired (false)
     *    </li>
     *    <li>
     *   'bubbles': whether or not this event bubbles (true)
     *              Events can only bubble if emitFacade is true.
     *    </li>
     *    <li>
     *   'context': the default execution context for the listeners (this)
     *    </li>
     *    <li>
     *   'defaultFn': the default function to execute when this event fires if preventDefault was not called
     *    </li>
     *    <li>
     *   'emitFacade': whether or not this event emits a facade (false)
     *    </li>
     *    <li>
     *   'prefix': the prefix for this targets events, e.g., 'menu' in 'menu:click'
     *    </li>
     *    <li>
     *   'fireOnce': if an event is configured to fire once, new subscribers after
     *   the fire will be notified immediately.
     *    </li>
     *    <li>
     *   'async': fireOnce event listeners will fire synchronously if the event has already
     *    fired unless async is true.
     *    </li>
     *    <li>
     *   'preventable': whether or not preventDefault() has an effect (true)
     *    </li>
     *    <li>
     *   'preventedFn': a function that is executed when preventDefault is called
     *    </li>
     *    <li>
     *   'queuable': whether or not this event can be queued during bubbling (false)
     *    </li>
     *    <li>
     *   'silent': if silent is true, debug messages are not provided for this event.
     *    </li>
     *    <li>
     *   'stoppedFn': a function that is executed when stopPropagation is called
     *    </li>
     *
     *    <li>
     *   'monitored': specifies whether or not this event should send notifications about
     *   when the event has been attached, detached, or published.
     *    </li>
     *    <li>
     *   'type': the event type (valid option if not provided as the first parameter to publish)
     *    </li>
     *  </ul>
     *
     *  @return {CustomEvent} the custom event
     *
     */
    publish: function(type, opts) {

        var ret,
            etState = this._yuievt,
            etConfig = etState.config,
            pre = etConfig.prefix;

        if (typeof type === "string")  {
            if (pre) {
                type = _getType(type, pre);
            }
            ret = this._publish(type, etConfig, opts);
        } else {
            ret = {};

            Y.each(type, function(v, k) {
                if (pre) {
                    k = _getType(k, pre);
                }
                ret[k] = this._publish(k, etConfig, v || opts);
            }, this);

        }

        return ret;
    },

    /**
     * Returns the fully qualified type, given a short type string.
     * That is, returns "foo:bar" when given "bar" if "foo" is the configured prefix.
     *
     * NOTE: This method, unlike _getType, does no checking of the value passed in, and
     * is designed to be used with the low level _publish() method, for critical path
     * implementations which need to fast-track publish for performance reasons.
     *
     * @method _getFullType
     * @private
     * @param {String} type The short type to prefix
     * @return {String} The prefixed type, if a prefix is set, otherwise the type passed in
     */
    _getFullType : function(type) {

        var pre = this._yuievt.config.prefix;

        if (pre) {
            return pre + PREFIX_DELIMITER + type;
        } else {
            return type;
        }
    },

    /**
     * The low level event publish implementation. It expects all the massaging to have been done
     * outside of this method. e.g. the `type` to `fullType` conversion. It's designed to be a fast
     * path publish, which can be used by critical code paths to improve performance.
     *
     * @method _publish
     * @private
     * @param {String} fullType The prefixed type of the event to publish.
     * @param {Object} etOpts The EventTarget specific configuration to mix into the published event.
     * @param {Object} ceOpts The publish specific configuration to mix into the published event.
     * @return {CustomEvent} The published event. If called without `etOpts` or `ceOpts`, this will
     * be the default `CustomEvent` instance, and can be configured independently.
     */
    _publish : function(fullType, etOpts, ceOpts) {

        var ce,
            etState = this._yuievt,
            etConfig = etState.config,
            host = etConfig.host,
            context = etConfig.context,
            events = etState.events;

        ce = events[fullType];

        // PERF: Hate to pull the check out of monitor, but trying to keep critical path tight.
        if ((etConfig.monitored && !ce) || (ce && ce.monitored)) {
            this._monitor('publish', fullType, {
                args: arguments
            });
        }

        if (!ce) {
            // Publish event
            ce = events[fullType] = new Y.CustomEvent(fullType, etOpts);

            if (!etOpts) {
                ce.host = host;
                ce.context = context;
            }
        }

        if (ceOpts) {
            mixConfigs(ce, ceOpts, true);
        }

        return ce;
    },

    /**
     * This is the entry point for the event monitoring system.
     * You can monitor 'attach', 'detach', 'fire', and 'publish'.
     * When configured, these events generate an event.  click ->
     * click_attach, click_detach, click_publish -- these can
     * be subscribed to like other events to monitor the event
     * system.  Inividual published events can have monitoring
     * turned on or off (publish can't be turned off before it
     * it published) by setting the events 'monitor' config.
     *
     * @method _monitor
     * @param what {String} 'attach', 'detach', 'fire', or 'publish'
     * @param eventType {String|CustomEvent} The prefixed name of the event being monitored, or the CustomEvent object.
     * @param o {Object} Information about the event interaction, such as
     *                  fire() args, subscription category, publish config
     * @private
     */
    _monitor: function(what, eventType, o) {
        var monitorevt, ce, type;

        if (eventType) {
            if (typeof eventType === "string") {
                type = eventType;
                ce = this.getEvent(eventType, true);
            } else {
                ce = eventType;
                type = eventType.type;
            }

            if ((this._yuievt.config.monitored && (!ce || ce.monitored)) || (ce && ce.monitored)) {
                monitorevt = type + '_' + what;
                o.monitored = what;
                this.fire.call(this, monitorevt, o);
            }
        }
    },

    /**
     * Fire a custom event by name.  The callback functions will be executed
     * from the context specified when the event was created, and with the
     * following parameters.
     *
     * The first argument is the event type, and any additional arguments are
     * passed to the listeners as parameters.  If the first of these is an
     * object literal, and the event is configured to emit an event facade,
     * that object is mixed into the event facade and the facade is provided
     * in place of the original object.
     *
     * If the custom event object hasn't been created, then the event hasn't
     * been published and it has no subscribers.  For performance sake, we
     * immediate exit in this case.  This means the event won't bubble, so
     * if the intention is that a bubble target be notified, the event must
     * be published on this object first.
     *
     * @method fire
     * @param type {String|Object} The type of the event, or an object that contains
     * a 'type' property.
     * @param arguments {Object*} an arbitrary set of parameters to pass to
     * the handler.  If the first of these is an object literal and the event is
     * configured to emit an event facade, the event facade will replace that
     * parameter after the properties the object literal contains are copied to
     * the event facade.
     * @return {Boolean} True if the whole lifecycle of the event went through,
     * false if at any point the event propagation was halted.
     */
    fire: function(type) {

        var typeIncluded = (typeof type === "string"),
            argCount = arguments.length,
            t = type,
            yuievt = this._yuievt,
            etConfig = yuievt.config,
            pre = etConfig.prefix,
            ret,
            ce,
            ce2,
            args;

        if (typeIncluded && argCount <= 3) {

            // PERF: Try to avoid slice/iteration for the common signatures

            // Most common
            if (argCount === 2) {
                args = [arguments[1]]; // fire("foo", {})
            } else if (argCount === 3) {
                args = [arguments[1], arguments[2]]; // fire("foo", {}, opts)
            } else {
                args = []; // fire("foo")
            }

        } else {
            args = nativeSlice.call(arguments, ((typeIncluded) ? 1 : 0));
        }

        if (!typeIncluded) {
            t = (type && type.type);
        }

        if (pre) {
            t = _getType(t, pre);
        }

        ce = yuievt.events[t];

        if (this._hasSiblings) {
            ce2 = this.getSibling(t, ce);

            if (ce2 && !ce) {
                ce = this.publish(t);
            }
        }

        // PERF: trying to avoid function call, since this is a critical path
        if ((etConfig.monitored && (!ce || ce.monitored)) || (ce && ce.monitored)) {
            this._monitor('fire', (ce || t), {
                args: args
            });
        }

        // this event has not been published or subscribed to
        if (!ce) {
            if (yuievt.hasTargets) {
                return this.bubble({ type: t }, args, this);
            }

            // otherwise there is nothing to be done
            ret = true;
        } else {

            if (ce2) {
                ce.sibling = ce2;
            }

            ret = ce._fire(args);
        }

        return (yuievt.chain) ? this : ret;
    },

    getSibling: function(type, ce) {
        var ce2;

        // delegate to *:type events if there are subscribers
        if (type.indexOf(PREFIX_DELIMITER) > -1) {
            type = _wildType(type);
            ce2 = this.getEvent(type, true);
            if (ce2) {
                ce2.applyConfig(ce);
                ce2.bubbles = false;
                ce2.broadcast = 0;
            }
        }

        return ce2;
    },

    /**
     * Returns the custom event of the provided type has been created, a
     * falsy value otherwise
     * @method getEvent
     * @param type {String} the type, or name of the event
     * @param prefixed {String} if true, the type is prefixed already
     * @return {CustomEvent} the custom event or null
     */
    getEvent: function(type, prefixed) {
        var pre, e;

        if (!prefixed) {
            pre = this._yuievt.config.prefix;
            type = (pre) ? _getType(type, pre) : type;
        }
        e = this._yuievt.events;
        return e[type] || null;
    },

    /**
     * Subscribe to a custom event hosted by this object.  The
     * supplied callback will execute after any listeners add
     * via the subscribe method, and after the default function,
     * if configured for the event, has executed.
     *
     * @method after
     * @param {String} type The name of the event
     * @param {Function} fn The callback to execute in response to the event
     * @param {Object} [context] Override `this` object in callback
     * @param {Any} [arg*] 0..n additional arguments to supply to the subscriber
     * @return {EventHandle} A subscription handle capable of detaching the
     *                       subscription
     */
    after: function(type, fn) {

        var a = nativeSlice.call(arguments, 0);

        switch (L.type(type)) {
            case 'function':
                return Y.Do.after.apply(Y.Do, arguments);
            case 'array':
            //     YArray.each(a[0], function(v) {
            //         v = AFTER_PREFIX + v;
            //     });
            //     break;
            case 'object':
                a[0]._after = true;
                break;
            default:
                a[0] = AFTER_PREFIX + type;
        }

        return this.on.apply(this, a);

    },

    /**
     * Executes the callback before a DOM event, custom event
     * or method.  If the first argument is a function, it
     * is assumed the target is a method.  For DOM and custom
     * events, this is an alias for Y.on.
     *
     * For DOM and custom events:
     * type, callback, context, 0-n arguments
     *
     * For methods:
     * callback, object (method host), methodName, context, 0-n arguments
     *
     * @method before
     * @return detach handle
     */
    before: function() {
        return this.on.apply(this, arguments);
    }

};

Y.EventTarget = ET;

// make Y an event target
Y.mix(Y, ET.prototype);
ET.call(Y, { bubbles: false });

YUI.Env.globalEvents = YUI.Env.globalEvents || new ET();

/**
 * Hosts YUI page level events.  This is where events bubble to
 * when the broadcast config is set to 2.  This property is
 * only available if the custom event module is loaded.
 * @property Global
 * @type EventTarget
 * @for YUI
 */
Y.Global = YUI.Env.globalEvents;

// @TODO implement a global namespace function on Y.Global?

/**
`Y.on()` can do many things:

<ul>
    <li>Subscribe to custom events `publish`ed and `fire`d from Y</li>
    <li>Subscribe to custom events `publish`ed with `broadcast` 1 or 2 and
        `fire`d from any object in the YUI instance sandbox</li>
    <li>Subscribe to DOM events</li>
    <li>Subscribe to the execution of a method on any object, effectively
    treating that method as an event</li>
</ul>

For custom event subscriptions, pass the custom event name as the first argument
and callback as the second. The `this` object in the callback will be `Y` unless
an override is passed as the third argument.

    Y.on('io:complete', function () {
        Y.MyApp.updateStatus('Transaction complete');
    });

To subscribe to DOM events, pass the name of a DOM event as the first argument
and a CSS selector string as the third argument after the callback function.
Alternately, the third argument can be a `Node`, `NodeList`, `HTMLElement`,
array, or simply omitted (the default is the `window` object).

    Y.on('click', function (e) {
        e.preventDefault();

        // proceed with ajax form submission
        var url = this.get('action');
        ...
    }, '#my-form');

The `this` object in DOM event callbacks will be the `Node` targeted by the CSS
selector or other identifier.

`on()` subscribers for DOM events or custom events `publish`ed with a
`defaultFn` can prevent the default behavior with `e.preventDefault()` from the
event object passed as the first parameter to the subscription callback.

To subscribe to the execution of an object method, pass arguments corresponding to the call signature for
<a href="../classes/Do.html#methods_before">`Y.Do.before(...)`</a>.

NOTE: The formal parameter list below is for events, not for function
injection.  See `Y.Do.before` for that signature.

@method on
@param {String} type DOM or custom event name
@param {Function} fn The callback to execute in response to the event
@param {Object} [context] Override `this` object in callback
@param {Any} [arg*] 0..n additional arguments to supply to the subscriber
@return {EventHandle} A subscription handle capable of detaching the
                      subscription
@see Do.before
@for YUI
**/

/**
Listen for an event one time.  Equivalent to `on()`, except that
the listener is immediately detached when executed.

See the <a href="#methods_on">`on()` method</a> for additional subscription
options.

@see on
@method once
@param {String} type DOM or custom event name
@param {Function} fn The callback to execute in response to the event
@param {Object} [context] Override `this` object in callback
@param {Any} [arg*] 0..n additional arguments to supply to the subscriber
@return {EventHandle} A subscription handle capable of detaching the
                      subscription
@for YUI
**/

/**
Listen for an event one time.  Equivalent to `once()`, except, like `after()`,
the subscription callback executes after all `on()` subscribers and the event's
`defaultFn` (if configured) have executed.  Like `after()` if any `on()` phase
subscriber calls `e.preventDefault()`, neither the `defaultFn` nor the `after()`
subscribers will execute.

The listener is immediately detached when executed.

See the <a href="#methods_on">`on()` method</a> for additional subscription
options.

@see once
@method onceAfter
@param {String} type The custom event name
@param {Function} fn The callback to execute in response to the event
@param {Object} [context] Override `this` object in callback
@param {Any} [arg*] 0..n additional arguments to supply to the subscriber
@return {EventHandle} A subscription handle capable of detaching the
                      subscription
@for YUI
**/

/**
Like `on()`, this method creates a subscription to a custom event or to the
execution of a method on an object.

For events, `after()` subscribers are executed after the event's
`defaultFn` unless `e.preventDefault()` was called from an `on()` subscriber.

See the <a href="#methods_on">`on()` method</a> for additional subscription
options.

NOTE: The subscription signature shown is for events, not for function
injection.  See <a href="../classes/Do.html#methods_after">`Y.Do.after`</a>
for that signature.

@see on
@see Do.after
@method after
@param {String} type The custom event name
@param {Function} fn The callback to execute in response to the event
@param {Object} [context] Override `this` object in callback
@param {Any} [args*] 0..n additional arguments to supply to the subscriber
@return {EventHandle} A subscription handle capable of detaching the
                      subscription
@for YUI
**/


}, '3.17.1', {"requires": ["oop"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-custom-complex', function (Y, NAME) {


/**
 * Adds event facades, preventable default behavior, and bubbling.
 * events.
 * @module event-custom
 * @submodule event-custom-complex
 */

var FACADE,
    FACADE_KEYS,
    YObject = Y.Object,
    key,
    EMPTY = {},
    CEProto = Y.CustomEvent.prototype,
    ETProto = Y.EventTarget.prototype,

    mixFacadeProps = function(facade, payload) {
        var p;

        for (p in payload) {
            if (!(FACADE_KEYS.hasOwnProperty(p))) {
                facade[p] = payload[p];
            }
        }
    };

/**
 * Wraps and protects a custom event for use when emitFacade is set to true.
 * Requires the event-custom-complex module
 * @class EventFacade
 * @param e {Event} the custom event
 * @param currentTarget {HTMLElement} the element the listener was attached to
 */

Y.EventFacade = function(e, currentTarget) {

    if (!e) {
        e = EMPTY;
    }

    this._event = e;

    /**
     * The arguments passed to fire
     * @property details
     * @type Array
     */
    this.details = e.details;

    /**
     * The event type, this can be overridden by the fire() payload
     * @property type
     * @type string
     */
    this.type = e.type;

    /**
     * The real event type
     * @property _type
     * @type string
     * @private
     */
    this._type = e.type;

    //////////////////////////////////////////////////////

    /**
     * Node reference for the targeted eventtarget
     * @property target
     * @type Node
     */
    this.target = e.target;

    /**
     * Node reference for the element that the listener was attached to.
     * @property currentTarget
     * @type Node
     */
    this.currentTarget = currentTarget;

    /**
     * Node reference to the relatedTarget
     * @property relatedTarget
     * @type Node
     */
    this.relatedTarget = e.relatedTarget;

};

Y.mix(Y.EventFacade.prototype, {

    /**
     * Stops the propagation to the next bubble target
     * @method stopPropagation
     */
    stopPropagation: function() {
        this._event.stopPropagation();
        this.stopped = 1;
    },

    /**
     * Stops the propagation to the next bubble target and
     * prevents any additional listeners from being exectued
     * on the current target.
     * @method stopImmediatePropagation
     */
    stopImmediatePropagation: function() {
        this._event.stopImmediatePropagation();
        this.stopped = 2;
    },

    /**
     * Prevents the event's default behavior
     * @method preventDefault
     */
    preventDefault: function() {
        this._event.preventDefault();
        this.prevented = 1;
    },

    /**
     * Stops the event propagation and prevents the default
     * event behavior.
     * @method halt
     * @param immediate {boolean} if true additional listeners
     * on the current target will not be executed
     */
    halt: function(immediate) {
        this._event.halt(immediate);
        this.prevented = 1;
        this.stopped = (immediate) ? 2 : 1;
    }

});

CEProto.fireComplex = function(args) {

    var es,
        ef,
        q,
        queue,
        ce,
        ret = true,
        events,
        subs,
        ons,
        afters,
        afterQueue,
        postponed,
        prevented,
        preventedFn,
        defaultFn,
        self = this,
        host = self.host || self,
        next,
        oldbubble,
        stack = self.stack,
        yuievt = host._yuievt,
        hasPotentialSubscribers;

    if (stack) {

        // queue this event if the current item in the queue bubbles
        if (self.queuable && self.type !== stack.next.type) {

            if (!stack.queue) {
                stack.queue = [];
            }
            stack.queue.push([self, args]);

            return true;
        }
    }

    hasPotentialSubscribers = self.hasSubs() || yuievt.hasTargets || self.broadcast;

    self.target = self.target || host;
    self.currentTarget = host;

    self.details = args.concat();

    if (hasPotentialSubscribers) {

        es = stack || {

           id: self.id, // id of the first event in the stack
           next: self,
           silent: self.silent,
           stopped: 0,
           prevented: 0,
           bubbling: null,
           type: self.type,
           // defaultFnQueue: new Y.Queue(),
           defaultTargetOnly: self.defaultTargetOnly

        };

        subs = self.getSubs();
        ons = subs[0];
        afters = subs[1];

        self.stopped = (self.type !== es.type) ? 0 : es.stopped;
        self.prevented = (self.type !== es.type) ? 0 : es.prevented;

        if (self.stoppedFn) {
            // PERF TODO: Can we replace with callback, like preventedFn. Look into history
            events = new Y.EventTarget({
                fireOnce: true,
                context: host
            });
            self.events = events;
            events.on('stopped', self.stoppedFn);
        }


        self._facade = null; // kill facade to eliminate stale properties

        ef = self._createFacade(args);

        if (ons) {
            self._procSubs(ons, args, ef);
        }

        // bubble if this is hosted in an event target and propagation has not been stopped
        if (self.bubbles && host.bubble && !self.stopped) {
            oldbubble = es.bubbling;

            es.bubbling = self.type;

            if (es.type !== self.type) {
                es.stopped = 0;
                es.prevented = 0;
            }

            ret = host.bubble(self, args, null, es);

            self.stopped = Math.max(self.stopped, es.stopped);
            self.prevented = Math.max(self.prevented, es.prevented);

            es.bubbling = oldbubble;
        }

        prevented = self.prevented;

        if (prevented) {
            preventedFn = self.preventedFn;
            if (preventedFn) {
                preventedFn.apply(host, args);
            }
        } else {
            defaultFn = self.defaultFn;

            if (defaultFn && ((!self.defaultTargetOnly && !es.defaultTargetOnly) || host === ef.target)) {
                defaultFn.apply(host, args);
            }
        }

        // broadcast listeners are fired as discreet events on the
        // YUI instance and potentially the YUI global.
        if (self.broadcast) {
            self._broadcast(args);
        }

        if (afters && !self.prevented && self.stopped < 2) {

            // Queue the after
            afterQueue = es.afterQueue;

            if (es.id === self.id || self.type !== yuievt.bubbling) {

                self._procSubs(afters, args, ef);

                if (afterQueue) {
                    while ((next = afterQueue.last())) {
                        next();
                    }
                }
            } else {
                postponed = afters;

                if (es.execDefaultCnt) {
                    postponed = Y.merge(postponed);

                    Y.each(postponed, function(s) {
                        s.postponed = true;
                    });
                }

                if (!afterQueue) {
                    es.afterQueue = new Y.Queue();
                }

                es.afterQueue.add(function() {
                    self._procSubs(postponed, args, ef);
                });
            }

        }

        self.target = null;

        if (es.id === self.id) {

            queue = es.queue;

            if (queue) {
                while (queue.length) {
                    q = queue.pop();
                    ce = q[0];
                    // set up stack to allow the next item to be processed
                    es.next = ce;
                    ce._fire(q[1]);
                }
            }

            self.stack = null;
        }

        ret = !(self.stopped);

        if (self.type !== yuievt.bubbling) {
            es.stopped = 0;
            es.prevented = 0;
            self.stopped = 0;
            self.prevented = 0;
        }

    } else {
        defaultFn = self.defaultFn;

        if(defaultFn) {
            ef = self._createFacade(args);

            if ((!self.defaultTargetOnly) || (host === ef.target)) {
                defaultFn.apply(host, args);
            }
        }
    }

    // Kill the cached facade to free up memory.
    // Otherwise we have the facade from the last fire, sitting around forever.
    self._facade = null;

    return ret;
};

/**
 * @method _hasPotentialSubscribers
 * @for CustomEvent
 * @private
 * @return {boolean} Whether the event has potential subscribers or not
 */
CEProto._hasPotentialSubscribers = function() {
    return this.hasSubs() || this.host._yuievt.hasTargets || this.broadcast;
};

/**
 * Internal utility method to create a new facade instance and
 * insert it into the fire argument list, accounting for any payload
 * merging which needs to happen.
 *
 * This used to be called `_getFacade`, but the name seemed inappropriate
 * when it was used without a need for the return value.
 *
 * @method _createFacade
 * @private
 * @param fireArgs {Array} The arguments passed to "fire", which need to be
 * shifted (and potentially merged) when the facade is added.
 * @return {EventFacade} The event facade created.
 */

// TODO: Remove (private) _getFacade alias, once synthetic.js is updated.
CEProto._createFacade = CEProto._getFacade = function(fireArgs) {

    var userArgs = this.details,
        firstArg = userArgs && userArgs[0],
        firstArgIsObj = (firstArg && (typeof firstArg === "object")),
        ef = this._facade;

    if (!ef) {
        ef = new Y.EventFacade(this, this.currentTarget);
    }

    if (firstArgIsObj) {
        // protect the event facade properties
        mixFacadeProps(ef, firstArg);

        // Allow the event type to be faked http://yuilibrary.com/projects/yui3/ticket/2528376
        if (firstArg.type) {
            ef.type = firstArg.type;
        }

        if (fireArgs) {
            fireArgs[0] = ef;
        }
    } else {
        if (fireArgs) {
            fireArgs.unshift(ef);
        }
    }

    // update the details field with the arguments
    ef.details = this.details;

    // use the original target when the event bubbled to this target
    ef.target = this.originalTarget || this.target;

    ef.currentTarget = this.currentTarget;
    ef.stopped = 0;
    ef.prevented = 0;

    this._facade = ef;

    return this._facade;
};

/**
 * Utility method to manipulate the args array passed in, to add the event facade,
 * if it's not already the first arg.
 *
 * @method _addFacadeToArgs
 * @private
 * @param {Array} The arguments to manipulate
 */
CEProto._addFacadeToArgs = function(args) {
    var e = args[0];

    // Trying not to use instanceof, just to avoid potential cross Y edge case issues.
    if (!(e && e.halt && e.stopImmediatePropagation && e.stopPropagation && e._event)) {
        this._createFacade(args);
    }
};

/**
 * Stop propagation to bubble targets
 * @for CustomEvent
 * @method stopPropagation
 */
CEProto.stopPropagation = function() {
    this.stopped = 1;
    if (this.stack) {
        this.stack.stopped = 1;
    }
    if (this.events) {
        this.events.fire('stopped', this);
    }
};

/**
 * Stops propagation to bubble targets, and prevents any remaining
 * subscribers on the current target from executing.
 * @method stopImmediatePropagation
 */
CEProto.stopImmediatePropagation = function() {
    this.stopped = 2;
    if (this.stack) {
        this.stack.stopped = 2;
    }
    if (this.events) {
        this.events.fire('stopped', this);
    }
};

/**
 * Prevents the execution of this event's defaultFn
 * @method preventDefault
 */
CEProto.preventDefault = function() {
    if (this.preventable) {
        this.prevented = 1;
        if (this.stack) {
            this.stack.prevented = 1;
        }
    }
};

/**
 * Stops the event propagation and prevents the default
 * event behavior.
 * @method halt
 * @param immediate {boolean} if true additional listeners
 * on the current target will not be executed
 */
CEProto.halt = function(immediate) {
    if (immediate) {
        this.stopImmediatePropagation();
    } else {
        this.stopPropagation();
    }
    this.preventDefault();
};

/**
 * Registers another EventTarget as a bubble target.  Bubble order
 * is determined by the order registered.  Multiple targets can
 * be specified.
 *
 * Events can only bubble if emitFacade is true.
 *
 * Included in the event-custom-complex submodule.
 *
 * @method addTarget
 * @chainable
 * @param o {EventTarget} the target to add
 * @for EventTarget
 */
ETProto.addTarget = function(o) {
    var etState = this._yuievt;

    if (!etState.targets) {
        etState.targets = {};
    }

    etState.targets[Y.stamp(o)] = o;
    etState.hasTargets = true;

    return this;
};

/**
 * Returns an array of bubble targets for this object.
 * @method getTargets
 * @return EventTarget[]
 */
ETProto.getTargets = function() {
    var targets = this._yuievt.targets;
    return targets ? YObject.values(targets) : [];
};

/**
 * Removes a bubble target
 * @method removeTarget
 * @chainable
 * @param o {EventTarget} the target to remove
 * @for EventTarget
 */
ETProto.removeTarget = function(o) {
    var targets = this._yuievt.targets;

    if (targets) {
        delete targets[Y.stamp(o, true)];

        if (YObject.size(targets) === 0) {
            this._yuievt.hasTargets = false;
        }
    }

    return this;
};

/**
 * Propagate an event.  Requires the event-custom-complex module.
 * @method bubble
 * @param evt {CustomEvent} the custom event to propagate
 * @return {boolean} the aggregated return value from Event.Custom.fire
 * @for EventTarget
 */
ETProto.bubble = function(evt, args, target, es) {

    var targs = this._yuievt.targets,
        ret = true,
        t,
        ce,
        i,
        bc,
        ce2,
        type = evt && evt.type,
        originalTarget = target || (evt && evt.target) || this,
        oldbubble;

    if (!evt || ((!evt.stopped) && targs)) {

        for (i in targs) {
            if (targs.hasOwnProperty(i)) {

                t = targs[i];

                ce = t._yuievt.events[type];

                if (t._hasSiblings) {
                    ce2 = t.getSibling(type, ce);
                }

                if (ce2 && !ce) {
                    ce = t.publish(type);
                }

                oldbubble = t._yuievt.bubbling;
                t._yuievt.bubbling = type;

                // if this event was not published on the bubble target,
                // continue propagating the event.
                if (!ce) {
                    if (t._yuievt.hasTargets) {
                        t.bubble(evt, args, originalTarget, es);
                    }
                } else {

                    if (ce2) {
                        ce.sibling = ce2;
                    }

                    // set the original target to that the target payload on the facade is correct.
                    ce.target = originalTarget;
                    ce.originalTarget = originalTarget;
                    ce.currentTarget = t;
                    bc = ce.broadcast;
                    ce.broadcast = false;

                    // default publish may not have emitFacade true -- that
                    // shouldn't be what the implementer meant to do
                    ce.emitFacade = true;

                    ce.stack = es;

                    // TODO: See what's getting in the way of changing this to use
                    // the more performant ce._fire(args || evt.details || []).

                    // Something in Widget Parent/Child tests is not happy if we
                    // change it - maybe evt.details related?
                    ret = ret && ce.fire.apply(ce, args || evt.details || []);

                    ce.broadcast = bc;
                    ce.originalTarget = null;

                    // stopPropagation() was called
                    if (ce.stopped) {
                        break;
                    }
                }

                t._yuievt.bubbling = oldbubble;
            }
        }
    }

    return ret;
};

/**
 * @method _hasPotentialSubscribers
 * @for EventTarget
 * @private
 * @param {String} fullType The fully prefixed type name
 * @return {boolean} Whether the event has potential subscribers or not
 */
ETProto._hasPotentialSubscribers = function(fullType) {

    var etState = this._yuievt,
        e = etState.events[fullType];

    if (e) {
        return e.hasSubs() || etState.hasTargets  || e.broadcast;
    } else {
        return false;
    }
};

FACADE = new Y.EventFacade();
FACADE_KEYS = {};

// Flatten whitelist
for (key in FACADE) {
    FACADE_KEYS[key] = true;
}


}, '3.17.1', {"requires": ["event-custom-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('intl', function (Y, NAME) {

var _mods = {},

    ROOT_LANG = "yuiRootLang",
    ACTIVE_LANG = "yuiActiveLang",
    NONE = [];

/**
 * Provides utilities to support the management of localized resources (strings and formatting patterns).
 *
 * @module intl
 */

/**
 * The Intl utility provides a central location for managing sets of localized resources (strings and formatting patterns).
 *
 * @class Intl
 * @uses EventTarget
 * @static
 */
Y.mix(Y.namespace("Intl"), {

    /**
     * Private method to retrieve the language hash for a given module.
     *
     * @method _mod
     * @private
     *
     * @param {String} module The name of the module
     * @return {Object} The hash of localized resources for the module, keyed by BCP language tag
     */
    _mod : function(module) {
        if (!_mods[module]) {
            _mods[module] = {};
        }
        return _mods[module];
    },

    /**
     * Sets the active language for the given module.
     *
     * Returns false on failure, which would happen if the language had not been registered through the <a href="#method_add">add()</a> method.
     *
     * @method setLang
     *
     * @param {String} module The module name.
     * @param {String} lang The BCP 47 language tag.
     * @return boolean true if successful, false if not.
     */
    setLang : function(module, lang) {
        var langs = this._mod(module),
            currLang = langs[ACTIVE_LANG],
            exists = !!langs[lang];

        if (exists && lang !== currLang) {
            langs[ACTIVE_LANG] = lang;
            this.fire("intl:langChange", {module: module, prevVal: currLang, newVal: (lang === ROOT_LANG) ? "" : lang});
        }

        return exists;
    },

    /**
     * Get the currently active language for the given module.
     *
     * @method getLang
     *
     * @param {String} module The module name.
     * @return {String} The BCP 47 language tag.
     */
    getLang : function(module) {
        var lang = this._mod(module)[ACTIVE_LANG];
        return (lang === ROOT_LANG) ? "" : lang;
    },

    /**
     * Register a hash of localized resources for the given module and language
     *
     * @method add
     *
     * @param {String} module The module name.
     * @param {String} lang The BCP 47 language tag.
     * @param {Object} strings The hash of localized values, keyed by the string name.
     */
    add : function(module, lang, strings) {
        lang = lang || ROOT_LANG;
        this._mod(module)[lang] = strings;
        this.setLang(module, lang);
    },

    /**
     * Gets the module's localized resources for the currently active language (as provided by the <a href="#method_getLang">getLang</a> method).
     * <p>
     * Optionally, the localized resources for alternate languages which have been added to Intl (see the <a href="#method_add">add</a> method) can
     * be retrieved by providing the BCP 47 language tag as the lang parameter.
     * </p>
     * @method get
     *
     * @param {String} module The module name.
     * @param {String} key Optional. A single resource key. If not provided, returns a copy (shallow clone) of all resources.
     * @param {String} lang Optional. The BCP 47 language tag. If not provided, the module's currently active language is used.
     * @return String | Object A copy of the module's localized resources, or a single value if key is provided.
     */
    get : function(module, key, lang) {
        var mod = this._mod(module),
            strs;

        lang = lang || mod[ACTIVE_LANG];
        strs = mod[lang] || {};

        return (key) ? strs[key] : Y.merge(strs);
    },

    /**
     * Gets the list of languages for which localized resources are available for a given module, based on the module
     * meta-data (part of loader). If loader is not on the page, returns an empty array.
     *
     * @method getAvailableLangs
     * @param {String} module The name of the module
     * @return {Array} The array of languages available.
     */
    getAvailableLangs : function(module) {
        var loader = Y.Env._loader,
            mod = loader && loader.moduleInfo[module],
            langs = mod && mod.lang;
        return (langs) ? langs.concat() : NONE;

    }
});

Y.augment(Y.Intl, Y.EventTarget);

/**
 * Notification event to indicate when the lang for a module has changed. There is no default behavior associated with this event,
 * so the on and after moments are equivalent.
 *
 * @event intl:langChange
 * @param {EventFacade} e The event facade
 * <p>The event facade contains:</p>
 * <dl>
 *     <dt>module</dt><dd>The name of the module for which the language changed</dd>
 *     <dt>newVal</dt><dd>The new language tag</dd>
 *     <dt>prevVal</dt><dd>The current language tag</dd>
 * </dl>
 */
Y.Intl.publish("intl:langChange", {emitFacade:true});


}, '3.17.1', {"requires": ["intl-base", "event-custom"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-base', function (Y, NAME) {

/*
 * DOM event listener abstraction layer
 * @module event
 * @submodule event-base
 */

/**
 * The domready event fires at the moment the browser's DOM is
 * usable. In most cases, this is before images are fully
 * downloaded, allowing you to provide a more responsive user
 * interface.
 *
 * In YUI 3, domready subscribers will be notified immediately if
 * that moment has already passed when the subscription is created.
 *
 * One exception is if the yui.js file is dynamically injected into
 * the page.  If this is done, you must tell the YUI instance that
 * you did this in order for DOMReady (and window load events) to
 * fire normally.  That configuration option is 'injected' -- set
 * it to true if the yui.js script is not included inline.
 *
 * This method is part of the 'event-ready' module, which is a
 * submodule of 'event'.
 *
 * @event domready
 * @for YUI
 */
Y.publish('domready', {
    fireOnce: true,
    async: true
});

if (YUI.Env.DOMReady) {
    Y.fire('domready');
} else {
    Y.Do.before(function() { Y.fire('domready'); }, YUI.Env, '_ready');
}

/**
 * Custom event engine, DOM event listener abstraction layer, synthetic DOM
 * events.
 * @module event
 * @submodule event-base
 */

/**
 * Wraps a DOM event, properties requiring browser abstraction are
 * fixed here.  Provids a security layer when required.
 * @class DOMEventFacade
 * @param ev {Event} the DOM event
 * @param currentTarget {HTMLElement} the element the listener was attached to
 * @param wrapper {CustomEvent} the custom event wrapper for this DOM event
 */

    var ua = Y.UA,

    EMPTY = {},

    /**
     * webkit key remapping required for Safari < 3.1
     * @property webkitKeymap
     * @private
     */
    webkitKeymap = {
        63232: 38, // up
        63233: 40, // down
        63234: 37, // left
        63235: 39, // right
        63276: 33, // page up
        63277: 34, // page down
        25:     9, // SHIFT-TAB (Safari provides a different key code in
                   // this case, even though the shiftKey modifier is set)
        63272: 46, // delete
        63273: 36, // home
        63275: 35  // end
    },

    /**
     * Returns a wrapped node.  Intended to be used on event targets,
     * so it will return the node's parent if the target is a text
     * node.
     *
     * If accessing a property of the node throws an error, this is
     * probably the anonymous div wrapper Gecko adds inside text
     * nodes.  This likely will only occur when attempting to access
     * the relatedTarget.  In this case, we now return null because
     * the anonymous div is completely useless and we do not know
     * what the related target was because we can't even get to
     * the element's parent node.
     *
     * @method resolve
     * @private
     */
    resolve = function(n) {
        if (!n) {
            return n;
        }
        try {
            if (n && 3 == n.nodeType) {
                n = n.parentNode;
            }
        } catch(e) {
            return null;
        }

        return Y.one(n);
    },

    DOMEventFacade = function(ev, currentTarget, wrapper) {
        this._event = ev;
        this._currentTarget = currentTarget;
        this._wrapper = wrapper || EMPTY;

        // if not lazy init
        this.init();
    };

Y.extend(DOMEventFacade, Object, {

    init: function() {

        var e = this._event,
            overrides = this._wrapper.overrides,
            x = e.pageX,
            y = e.pageY,
            c,
            currentTarget = this._currentTarget;

        this.altKey   = e.altKey;
        this.ctrlKey  = e.ctrlKey;
        this.metaKey  = e.metaKey;
        this.shiftKey = e.shiftKey;
        this.type     = (overrides && overrides.type) || e.type;
        this.clientX  = e.clientX;
        this.clientY  = e.clientY;

        this.pageX = x;
        this.pageY = y;

        // charCode is unknown in keyup, keydown. keyCode is unknown in keypress.
        // FF 3.6 - 8+? pass 0 for keyCode in keypress events.
        // Webkit, FF 3.6-8+?, and IE9+? pass 0 for charCode in keydown, keyup.
        // Webkit and IE9+? duplicate charCode in keyCode.
        // Opera never sets charCode, always keyCode (though with the charCode).
        // IE6-8 don't set charCode or which.
        // All browsers other than IE6-8 set which=keyCode in keydown, keyup, and
        // which=charCode in keypress.
        //
        // Moral of the story: (e.which || e.keyCode) will always return the
        // known code for that key event phase. e.keyCode is often different in
        // keypress from keydown and keyup.
        c = e.keyCode || e.charCode;

        if (ua.webkit && (c in webkitKeymap)) {
            c = webkitKeymap[c];
        }

        this.keyCode = c;
        this.charCode = c;
        // Fill in e.which for IE - implementers should always use this over
        // e.keyCode or e.charCode.
        this.which = e.which || e.charCode || c;
        // this.button = e.button;
        this.button = this.which;

        this.target = resolve(e.target);
        this.currentTarget = resolve(currentTarget);
        this.relatedTarget = resolve(e.relatedTarget);

        if (e.type == "mousewheel" || e.type == "DOMMouseScroll") {
            this.wheelDelta = (e.detail) ? (e.detail * -1) : Math.round(e.wheelDelta / 80) || ((e.wheelDelta < 0) ? -1 : 1);
        }

        if (this._touch) {
            this._touch(e, currentTarget, this._wrapper);
        }
    },

    stopPropagation: function() {
        this._event.stopPropagation();
        this._wrapper.stopped = 1;
        this.stopped = 1;
    },

    stopImmediatePropagation: function() {
        var e = this._event;
        if (e.stopImmediatePropagation) {
            e.stopImmediatePropagation();
        } else {
            this.stopPropagation();
        }
        this._wrapper.stopped = 2;
        this.stopped = 2;
    },

    preventDefault: function(returnValue) {
        var e = this._event;
        e.preventDefault();
        if (returnValue) {
            e.returnValue = returnValue;
        }
        this._wrapper.prevented = 1;
        this.prevented = 1;
    },

    halt: function(immediate) {
        if (immediate) {
            this.stopImmediatePropagation();
        } else {
            this.stopPropagation();
        }

        this.preventDefault();
    }

});

DOMEventFacade.resolve = resolve;
Y.DOM2EventFacade = DOMEventFacade;
Y.DOMEventFacade = DOMEventFacade;

    /**
     * The native event
     * @property _event
     * @type {DOMEvent}
     * @private
     */

    /**
    The name of the event (e.g. "click")

    @property type
    @type {String}
    **/

    /**
    `true` if the "alt" or "option" key is pressed.

    @property altKey
    @type {Boolean}
    **/

    /**
    `true` if the shift key is pressed.

    @property shiftKey
    @type {Boolean}
    **/

    /**
    `true` if the "Windows" key on a Windows keyboard, "command" key on an
    Apple keyboard, or "meta" key on other keyboards is pressed.

    @property metaKey
    @type {Boolean}
    **/

    /**
    `true` if the "Ctrl" or "control" key is pressed.

    @property ctrlKey
    @type {Boolean}
    **/

    /**
     * The X location of the event on the page (including scroll)
     * @property pageX
     * @type {Number}
     */

    /**
     * The Y location of the event on the page (including scroll)
     * @property pageY
     * @type {Number}
     */

    /**
     * The X location of the event in the viewport
     * @property clientX
     * @type {Number}
     */

    /**
     * The Y location of the event in the viewport
     * @property clientY
     * @type {Number}
     */

    /**
     * The keyCode for key events.  Uses charCode if keyCode is not available
     * @property keyCode
     * @type {Number}
     */

    /**
     * The charCode for key events.  Same as keyCode
     * @property charCode
     * @type {Number}
     */

    /**
     * The button that was pushed. 1 for left click, 2 for middle click, 3 for
     * right click.  This is only reliably populated on `mouseup` events.
     * @property button
     * @type {Number}
     */

    /**
     * The button that was pushed.  Same as button.
     * @property which
     * @type {Number}
     */

    /**
     * Node reference for the targeted element
     * @property target
     * @type {Node}
     */

    /**
     * Node reference for the element that the listener was attached to.
     * @property currentTarget
     * @type {Node}
     */

    /**
     * Node reference to the relatedTarget
     * @property relatedTarget
     * @type {Node}
     */

    /**
     * Number representing the direction and velocity of the movement of the mousewheel.
     * Negative is down, the higher the number, the faster.  Applies to the mousewheel event.
     * @property wheelDelta
     * @type {Number}
     */

    /**
     * Stops the propagation to the next bubble target
     * @method stopPropagation
     */

    /**
     * Stops the propagation to the next bubble target and
     * prevents any additional listeners from being exectued
     * on the current target.
     * @method stopImmediatePropagation
     */

    /**
     * Prevents the event's default behavior
     * @method preventDefault
     * @param returnValue {string} sets the returnValue of the event to this value
     * (rather than the default false value).  This can be used to add a customized
     * confirmation query to the beforeunload event).
     */

    /**
     * Stops the event propagation and prevents the default
     * event behavior.
     * @method halt
     * @param immediate {boolean} if true additional listeners
     * on the current target will not be executed
     */
(function() {

/**
 * The event utility provides functions to add and remove event listeners,
 * event cleansing.  It also tries to automatically remove listeners it
 * registers during the unload event.
 * @module event
 * @main event
 * @submodule event-base
 */

/**
 * The event utility provides functions to add and remove event listeners,
 * event cleansing.  It also tries to automatically remove listeners it
 * registers during the unload event.
 *
 * @class Event
 * @static
 */

Y.Env.evt.dom_wrappers = {};
Y.Env.evt.dom_map = {};

var _eventenv = Y.Env.evt,
    config = Y.config,
    win = config.win,
    add = YUI.Env.add,
    remove = YUI.Env.remove,

    onLoad = function() {
        YUI.Env.windowLoaded = true;
        Y.Event._load();
        remove(win, "load", onLoad);
    },

    onUnload = function() {
        Y.Event._unload();
    },

    EVENT_READY = 'domready',

    COMPAT_ARG = '~yui|2|compat~',

    shouldIterate = function(o) {
        try {
            // TODO: See if there's a more performant way to return true early on this, for the common case
            return (o && typeof o !== "string" && Y.Lang.isNumber(o.length) && !o.tagName && !Y.DOM.isWindow(o));
        } catch(ex) {
            return false;
        }
    },

    // aliases to support DOM event subscription clean up when the last
    // subscriber is detached. deleteAndClean overrides the DOM event's wrapper
    // CustomEvent _delete method.
    _ceProtoDelete = Y.CustomEvent.prototype._delete,
    _deleteAndClean = function(s) {
        var ret = _ceProtoDelete.apply(this, arguments);

        if (!this.hasSubs()) {
            Y.Event._clean(this);
        }

        return ret;
    },

Event = function() {

    /**
     * True after the onload event has fired
     * @property _loadComplete
     * @type boolean
     * @static
     * @private
     */
    var _loadComplete =  false,

    /**
     * The number of times to poll after window.onload.  This number is
     * increased if additional late-bound handlers are requested after
     * the page load.
     * @property _retryCount
     * @static
     * @private
     */
    _retryCount = 0,

    /**
     * onAvailable listeners
     * @property _avail
     * @static
     * @private
     */
    _avail = [],

    /**
     * Custom event wrappers for DOM events.  Key is
     * 'event:' + Element uid stamp + event type
     * @property _wrappers
     * @type CustomEvent
     * @static
     * @private
     */
    _wrappers = _eventenv.dom_wrappers,

    _windowLoadKey = null,

    /**
     * Custom event wrapper map DOM events.  Key is
     * Element uid stamp.  Each item is a hash of custom event
     * wrappers as provided in the _wrappers collection.  This
     * provides the infrastructure for getListeners.
     * @property _el_events
     * @static
     * @private
     */
    _el_events = _eventenv.dom_map;

    return {

        /**
         * The number of times we should look for elements that are not
         * in the DOM at the time the event is requested after the document
         * has been loaded.  The default is 1000@amp;40 ms, so it will poll
         * for 40 seconds or until all outstanding handlers are bound
         * (whichever comes first).
         * @property POLL_RETRYS
         * @type int
         * @static
         * @final
         */
        POLL_RETRYS: 1000,

        /**
         * The poll interval in milliseconds
         * @property POLL_INTERVAL
         * @type int
         * @static
         * @final
         */
        POLL_INTERVAL: 40,

        /**
         * addListener/removeListener can throw errors in unexpected scenarios.
         * These errors are suppressed, the method returns false, and this property
         * is set
         * @property lastError
         * @static
         * @type Error
         */
        lastError: null,


        /**
         * poll handle
         * @property _interval
         * @static
         * @private
         */
        _interval: null,

        /**
         * document readystate poll handle
         * @property _dri
         * @static
         * @private
         */
         _dri: null,

        /**
         * True when the document is initially usable
         * @property DOMReady
         * @type boolean
         * @static
         */
        DOMReady: false,

        /**
         * @method startInterval
         * @static
         * @private
         */
        startInterval: function() {
            if (!Event._interval) {
Event._interval = setInterval(Event._poll, Event.POLL_INTERVAL);
            }
        },

        /**
         * Executes the supplied callback when the item with the supplied
         * id is found.  This is meant to be used to execute behavior as
         * soon as possible as the page loads.  If you use this after the
         * initial page load it will poll for a fixed time for the element.
         * The number of times it will poll and the frequency are
         * configurable.  By default it will poll for 10 seconds.
         *
         * <p>The callback is executed with a single parameter:
         * the custom object parameter, if provided.</p>
         *
         * @method onAvailable
         *
         * @param {string||string[]}   id the id of the element, or an array
         * of ids to look for.
         * @param {function} fn what to execute when the element is found.
         * @param {object}   p_obj an optional object to be passed back as
         *                   a parameter to fn.
         * @param {boolean|object}  p_override If set to true, fn will execute
         *                   in the context of p_obj, if set to an object it
         *                   will execute in the context of that object
         * @param checkContent {boolean} check child node readiness (onContentReady)
         * @static
         * @deprecated Use Y.on("available")
         */
        // @TODO fix arguments
        onAvailable: function(id, fn, p_obj, p_override, checkContent, compat) {

            var a = Y.Array(id), i, availHandle;

            for (i=0; i<a.length; i=i+1) {
                _avail.push({
                    id:         a[i],
                    fn:         fn,
                    obj:        p_obj,
                    override:   p_override,
                    checkReady: checkContent,
                    compat:     compat
                });
            }
            _retryCount = this.POLL_RETRYS;

            // We want the first test to be immediate, but async
            setTimeout(Event._poll, 0);

            availHandle = new Y.EventHandle({

                _delete: function() {
                    // set by the event system for lazy DOM listeners
                    if (availHandle.handle) {
                        availHandle.handle.detach();
                        return;
                    }

                    var i, j;

                    // otherwise try to remove the onAvailable listener(s)
                    for (i = 0; i < a.length; i++) {
                        for (j = 0; j < _avail.length; j++) {
                            if (a[i] === _avail[j].id) {
                                _avail.splice(j, 1);
                            }
                        }
                    }
                }

            });

            return availHandle;
        },

        /**
         * Works the same way as onAvailable, but additionally checks the
         * state of sibling elements to determine if the content of the
         * available element is safe to modify.
         *
         * <p>The callback is executed with a single parameter:
         * the custom object parameter, if provided.</p>
         *
         * @method onContentReady
         *
         * @param {string}   id the id of the element to look for.
         * @param {function} fn what to execute when the element is ready.
         * @param {object}   obj an optional object to be passed back as
         *                   a parameter to fn.
         * @param {boolean|object}  override If set to true, fn will execute
         *                   in the context of p_obj.  If an object, fn will
         *                   exectute in the context of that object
         *
         * @static
         * @deprecated Use Y.on("contentready")
         */
        // @TODO fix arguments
        onContentReady: function(id, fn, obj, override, compat) {
            return Event.onAvailable(id, fn, obj, override, true, compat);
        },

        /**
         * Adds an event listener
         *
         * @method attach
         *
         * @param {String}   type     The type of event to append
         * @param {Function} fn        The method the event invokes
         * @param {String|HTMLElement|Array|NodeList} el An id, an element
         *  reference, or a collection of ids and/or elements to assign the
         *  listener to.
         * @param {Object}   context optional context object
         * @param {Boolean|object}  args 0..n arguments to pass to the callback
         * @return {EventHandle} an object to that can be used to detach the listener
         *
         * @static
         */

        attach: function(type, fn, el, context) {
            return Event._attach(Y.Array(arguments, 0, true));
        },

        _createWrapper: function (el, type, capture, compat, facade) {

            var cewrapper,
                ek  = Y.stamp(el),
                key = 'event:' + ek + type;

            if (false === facade) {
                key += 'native';
            }
            if (capture) {
                key += 'capture';
            }


            cewrapper = _wrappers[key];


            if (!cewrapper) {
                // create CE wrapper
                cewrapper = Y.publish(key, {
                    silent: true,
                    bubbles: false,
                    emitFacade:false,
                    contextFn: function() {
                        if (compat) {
                            return cewrapper.el;
                        } else {
                            cewrapper.nodeRef = cewrapper.nodeRef || Y.one(cewrapper.el);
                            return cewrapper.nodeRef;
                        }
                    }
                });

                cewrapper.overrides = {};

                // for later removeListener calls
                cewrapper.el = el;
                cewrapper.key = key;
                cewrapper.domkey = ek;
                cewrapper.type = type;
                cewrapper.fn = function(e) {
                    cewrapper.fire(Event.getEvent(e, el, (compat || (false === facade))));
                };
                cewrapper.capture = capture;

                if (el == win && type == "load") {
                    // window load happens once
                    cewrapper.fireOnce = true;
                    _windowLoadKey = key;
                }
                cewrapper._delete = _deleteAndClean;

                _wrappers[key] = cewrapper;
                _el_events[ek] = _el_events[ek] || {};
                _el_events[ek][key] = cewrapper;

                add(el, type, cewrapper.fn, capture);
            }

            return cewrapper;

        },

        _attach: function(args, conf) {

            var compat,
                handles, oEl, cewrapper, context,
                fireNow = false, ret,
                type = args[0],
                fn = args[1],
                el = args[2] || win,
                facade = conf && conf.facade,
                capture = conf && conf.capture,
                overrides = conf && conf.overrides;

            if (args[args.length-1] === COMPAT_ARG) {
                compat = true;
            }

            if (!fn || !fn.call) {
                return false;
            }

            // The el argument can be an array of elements or element ids.
            if (shouldIterate(el)) {

                handles=[];

                Y.each(el, function(v, k) {
                    args[2] = v;
                    handles.push(Event._attach(args.slice(), conf));
                });

                // return (handles.length === 1) ? handles[0] : handles;
                return new Y.EventHandle(handles);

            // If the el argument is a string, we assume it is
            // actually the id of the element.  If the page is loaded
            // we convert el to the actual element, otherwise we
            // defer attaching the event until the element is
            // ready
            } else if (Y.Lang.isString(el)) {

                // oEl = (compat) ? Y.DOM.byId(el) : Y.Selector.query(el);

                if (compat) {
                    oEl = Y.DOM.byId(el);
                } else {

                    oEl = Y.Selector.query(el);

                    switch (oEl.length) {
                        case 0:
                            oEl = null;
                            break;
                        case 1:
                            oEl = oEl[0];
                            break;
                        default:
                            args[2] = oEl;
                            return Event._attach(args, conf);
                    }
                }

                if (oEl) {

                    el = oEl;

                // Not found = defer adding the event until the element is available
                } else {

                    ret = Event.onAvailable(el, function() {

                        ret.handle = Event._attach(args, conf);

                    }, Event, true, false, compat);

                    return ret;

                }
            }

            // Element should be an html element or node
            if (!el) {
                return false;
            }

            if (Y.Node && Y.instanceOf(el, Y.Node)) {
                el = Y.Node.getDOMNode(el);
            }

            cewrapper = Event._createWrapper(el, type, capture, compat, facade);
            if (overrides) {
                Y.mix(cewrapper.overrides, overrides);
            }

            if (el == win && type == "load") {

                // if the load is complete, fire immediately.
                // all subscribers, including the current one
                // will be notified.
                if (YUI.Env.windowLoaded) {
                    fireNow = true;
                }
            }

            if (compat) {
                args.pop();
            }

            context = args[3];

            // set context to the Node if not specified
            // ret = cewrapper.on.apply(cewrapper, trimmedArgs);
            ret = cewrapper._on(fn, context, (args.length > 4) ? args.slice(4) : null);

            if (fireNow) {
                cewrapper.fire();
            }

            return ret;

        },

        /**
         * Removes an event listener.  Supports the signature the event was bound
         * with, but the preferred way to remove listeners is using the handle
         * that is returned when using Y.on
         *
         * @method detach
         *
         * @param {String} type the type of event to remove.
         * @param {Function} fn the method the event invokes.  If fn is
         * undefined, then all event handlers for the type of event are
         * removed.
         * @param {String|HTMLElement|Array|NodeList|EventHandle} el An
         * event handle, an id, an element reference, or a collection
         * of ids and/or elements to remove the listener from.
         * @return {boolean} true if the unbind was successful, false otherwise.
         * @static
         */
        detach: function(type, fn, el, obj) {

            var args=Y.Array(arguments, 0, true), compat, l, ok, i,
                id, ce;

            if (args[args.length-1] === COMPAT_ARG) {
                compat = true;
                // args.pop();
            }

            if (type && type.detach) {
                return type.detach();
            }

            // The el argument can be a string
            if (typeof el == "string") {

                // el = (compat) ? Y.DOM.byId(el) : Y.all(el);
                if (compat) {
                    el = Y.DOM.byId(el);
                } else {
                    el = Y.Selector.query(el);
                    l = el.length;
                    if (l < 1) {
                        el = null;
                    } else if (l == 1) {
                        el = el[0];
                    }
                }
                // return Event.detach.apply(Event, args);
            }

            if (!el) {
                return false;
            }

            if (el.detach) {
                args.splice(2, 1);
                return el.detach.apply(el, args);
            // The el argument can be an array of elements or element ids.
            } else if (shouldIterate(el)) {
                ok = true;
                for (i=0, l=el.length; i<l; ++i) {
                    args[2] = el[i];
                    ok = ( Y.Event.detach.apply(Y.Event, args) && ok );
                }

                return ok;
            }

            if (!type || !fn || !fn.call) {
                return Event.purgeElement(el, false, type);
            }

            id = 'event:' + Y.stamp(el) + type;
            ce = _wrappers[id];

            if (ce) {
                return ce.detach(fn);
            } else {
                return false;
            }

        },

        /**
         * Finds the event in the window object, the caller's arguments, or
         * in the arguments of another method in the callstack.  This is
         * executed automatically for events registered through the event
         * manager, so the implementer should not normally need to execute
         * this function at all.
         * @method getEvent
         * @param {Event} e the event parameter from the handler
         * @param {HTMLElement} el the element the listener was attached to
         * @return {Event} the event
         * @static
         */
        getEvent: function(e, el, noFacade) {
            var ev = e || win.event;

            return (noFacade) ? ev :
                new Y.DOMEventFacade(ev, el, _wrappers['event:' + Y.stamp(el) + e.type]);
        },

        /**
         * Generates an unique ID for the element if it does not already
         * have one.
         * @method generateId
         * @param el the element to create the id for
         * @return {string} the resulting id of the element
         * @static
         */
        generateId: function(el) {
            return Y.DOM.generateID(el);
        },

        /**
         * We want to be able to use getElementsByTagName as a collection
         * to attach a group of events to.  Unfortunately, different
         * browsers return different types of collections.  This function
         * tests to determine if the object is array-like.  It will also
         * fail if the object is an array, but is empty.
         * @method _isValidCollection
         * @param o the object to test
         * @return {boolean} true if the object is array-like and populated
         * @deprecated was not meant to be used directly
         * @static
         * @private
         */
        _isValidCollection: shouldIterate,

        /**
         * hook up any deferred listeners
         * @method _load
         * @static
         * @private
         */
        _load: function(e) {
            if (!_loadComplete) {
                _loadComplete = true;

                // Just in case DOMReady did not go off for some reason
                // E._ready();
                if (Y.fire) {
                    Y.fire(EVENT_READY);
                }

                // Available elements may not have been detected before the
                // window load event fires. Try to find them now so that the
                // the user is more likely to get the onAvailable notifications
                // before the window load notification
                Event._poll();
            }
        },

        /**
         * Polling function that runs before the onload event fires,
         * attempting to attach to DOM Nodes as soon as they are
         * available
         * @method _poll
         * @static
         * @private
         */
        _poll: function() {
            if (Event.locked) {
                return;
            }

            if (Y.UA.ie && !YUI.Env.DOMReady) {
                // Hold off if DOMReady has not fired and check current
                // readyState to protect against the IE operation aborted
                // issue.
                Event.startInterval();
                return;
            }

            Event.locked = true;

            // keep trying until after the page is loaded.  We need to
            // check the page load state prior to trying to bind the
            // elements so that we can be certain all elements have been
            // tested appropriately
            var i, len, item, el, notAvail, executeItem,
                tryAgain = !_loadComplete;

            if (!tryAgain) {
                tryAgain = (_retryCount > 0);
            }

            // onAvailable
            notAvail = [];

            executeItem = function (el, item) {
                var context, ov = item.override;
                try {
                    if (item.compat) {
                        if (item.override) {
                            if (ov === true) {
                                context = item.obj;
                            } else {
                                context = ov;
                            }
                        } else {
                            context = el;
                        }
                        item.fn.call(context, item.obj);
                    } else {
                        context = item.obj || Y.one(el);
                        item.fn.apply(context, (Y.Lang.isArray(ov)) ? ov : []);
                    }
                } catch (e) {
                }
            };

            // onAvailable
            for (i=0,len=_avail.length; i<len; ++i) {
                item = _avail[i];
                if (item && !item.checkReady) {

                    // el = (item.compat) ? Y.DOM.byId(item.id) : Y.one(item.id);
                    el = (item.compat) ? Y.DOM.byId(item.id) : Y.Selector.query(item.id, null, true);

                    if (el) {
                        executeItem(el, item);
                        _avail[i] = null;
                    } else {
                        notAvail.push(item);
                    }
                }
            }

            // onContentReady
            for (i=0,len=_avail.length; i<len; ++i) {
                item = _avail[i];
                if (item && item.checkReady) {

                    // el = (item.compat) ? Y.DOM.byId(item.id) : Y.one(item.id);
                    el = (item.compat) ? Y.DOM.byId(item.id) : Y.Selector.query(item.id, null, true);

                    if (el) {
                        // The element is available, but not necessarily ready
                        // @todo should we test parentNode.nextSibling?
                        if (_loadComplete || (el.get && el.get('nextSibling')) || el.nextSibling) {
                            executeItem(el, item);
                            _avail[i] = null;
                        }
                    } else {
                        notAvail.push(item);
                    }
                }
            }

            _retryCount = (notAvail.length === 0) ? 0 : _retryCount - 1;

            if (tryAgain) {
                // we may need to strip the nulled out items here
                Event.startInterval();
            } else {
                clearInterval(Event._interval);
                Event._interval = null;
            }

            Event.locked = false;

            return;

        },

        /**
         * Removes all listeners attached to the given element via addListener.
         * Optionally, the node's children can also be purged.
         * Optionally, you can specify a specific type of event to remove.
         * @method purgeElement
         * @param {HTMLElement} el the element to purge
         * @param {boolean} recurse recursively purge this element's children
         * as well.  Use with caution.
         * @param {string} type optional type of listener to purge. If
         * left out, all listeners will be removed
         * @static
         */
        purgeElement: function(el, recurse, type) {
            // var oEl = (Y.Lang.isString(el)) ? Y.one(el) : el,
            var oEl = (Y.Lang.isString(el)) ?  Y.Selector.query(el, null, true) : el,
                lis = Event.getListeners(oEl, type), i, len, children, child;

            if (recurse && oEl) {
                lis = lis || [];
                children = Y.Selector.query('*', oEl);
                len = children.length;
                for (i = 0; i < len; ++i) {
                    child = Event.getListeners(children[i], type);
                    if (child) {
                        lis = lis.concat(child);
                    }
                }
            }

            if (lis) {
                for (i = 0, len = lis.length; i < len; ++i) {
                    lis[i].detachAll();
                }
            }

        },

        /**
         * Removes all object references and the DOM proxy subscription for
         * a given event for a DOM node.
         *
         * @method _clean
         * @param wrapper {CustomEvent} Custom event proxy for the DOM
         *                  subscription
         * @private
         * @static
         * @since 3.4.0
         */
        _clean: function (wrapper) {
            var key    = wrapper.key,
                domkey = wrapper.domkey;

            remove(wrapper.el, wrapper.type, wrapper.fn, wrapper.capture);
            delete _wrappers[key];
            delete Y._yuievt.events[key];
            if (_el_events[domkey]) {
                delete _el_events[domkey][key];
                if (!Y.Object.size(_el_events[domkey])) {
                    delete _el_events[domkey];
                }
            }
        },

        /**
         * Returns all listeners attached to the given element via addListener.
         * Optionally, you can specify a specific type of event to return.
         * @method getListeners
         * @param el {HTMLElement|string} the element or element id to inspect
         * @param type {string} optional type of listener to return. If
         * left out, all listeners will be returned
         * @return {CustomEvent} the custom event wrapper for the DOM event(s)
         * @static
         */
        getListeners: function(el, type) {
            var ek = Y.stamp(el, true), evts = _el_events[ek],
                results=[] , key = (type) ? 'event:' + ek + type : null,
                adapters = _eventenv.plugins;

            if (!evts) {
                return null;
            }

            if (key) {
                // look for synthetic events
                if (adapters[type] && adapters[type].eventDef) {
                    key += '_synth';
                }

                if (evts[key]) {
                    results.push(evts[key]);
                }

                // get native events as well
                key += 'native';
                if (evts[key]) {
                    results.push(evts[key]);
                }

            } else {
                Y.each(evts, function(v, k) {
                    results.push(v);
                });
            }

            return (results.length) ? results : null;
        },

        /**
         * Removes all listeners registered by pe.event.  Called
         * automatically during the unload event.
         * @method _unload
         * @static
         * @private
         */
        _unload: function(e) {
            Y.each(_wrappers, function(v, k) {
                if (v.type == 'unload') {
                    v.fire(e);
                }
                v.detachAll();
            });
            remove(win, "unload", onUnload);
        },

        /**
         * Adds a DOM event directly without the caching, cleanup, context adj, etc
         *
         * @method nativeAdd
         * @param {HTMLElement} el      the element to bind the handler to
         * @param {string}      type   the type of event handler
         * @param {function}    fn      the callback to invoke
         * @param {Boolean}      capture capture or bubble phase
         * @static
         * @private
         */
        nativeAdd: add,

        /**
         * Basic remove listener
         *
         * @method nativeRemove
         * @param {HTMLElement} el      the element to bind the handler to
         * @param {string}      type   the type of event handler
         * @param {function}    fn      the callback to invoke
         * @param {Boolean}      capture capture or bubble phase
         * @static
         * @private
         */
        nativeRemove: remove
    };

}();

Y.Event = Event;

if (config.injected || YUI.Env.windowLoaded) {
    onLoad();
} else {
    add(win, "load", onLoad);
}

// Process onAvailable/onContentReady items when when the DOM is ready in IE
if (Y.UA.ie) {
    Y.on(EVENT_READY, Event._poll);

    // In IE6 and below, detach event handlers when the page is unloaded in
    // order to try and prevent cross-page memory leaks. This isn't done in
    // other browsers because a) it's not necessary, and b) it breaks the
    // back/forward cache.
    if (Y.UA.ie < 7) {
        try {
            add(win, "unload", onUnload);
        } catch(e) {
        }
    }
}

Event.Custom = Y.CustomEvent;
Event.Subscriber = Y.Subscriber;
Event.Target = Y.EventTarget;
Event.Handle = Y.EventHandle;
Event.Facade = Y.EventFacade;

Event._poll();

}());

/**
 * DOM event listener abstraction layer
 * @module event
 * @submodule event-base
 */

/**
 * Executes the callback as soon as the specified element
 * is detected in the DOM.  This function expects a selector
 * string for the element(s) to detect.  If you already have
 * an element reference, you don't need this event.
 * @event available
 * @param type {string} 'available'
 * @param fn {function} the callback function to execute.
 * @param el {string} an selector for the element(s) to attach
 * @param context optional argument that specifies what 'this' refers to.
 * @param args* 0..n additional arguments to pass on to the callback function.
 * These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @for YUI
 */
Y.Env.evt.plugins.available = {
    on: function(type, fn, id, o) {
        var a = arguments.length > 4 ?  Y.Array(arguments, 4, true) : null;
        return Y.Event.onAvailable.call(Y.Event, id, fn, o, a);
    }
};

/**
 * Executes the callback as soon as the specified element
 * is detected in the DOM with a nextSibling property
 * (indicating that the element's children are available).
 * This function expects a selector
 * string for the element(s) to detect.  If you already have
 * an element reference, you don't need this event.
 * @event contentready
 * @param type {string} 'contentready'
 * @param fn {function} the callback function to execute.
 * @param el {string} an selector for the element(s) to attach.
 * @param context optional argument that specifies what 'this' refers to.
 * @param args* 0..n additional arguments to pass on to the callback function.
 * These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @for YUI
 */
Y.Env.evt.plugins.contentready = {
    on: function(type, fn, id, o) {
        var a = arguments.length > 4 ? Y.Array(arguments, 4, true) : null;
        return Y.Event.onContentReady.call(Y.Event, id, fn, o, a);
    }
};


}, '3.17.1', {"requires": ["event-custom-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('dom-core', function (Y, NAME) {

var NODE_TYPE = 'nodeType',
    OWNER_DOCUMENT = 'ownerDocument',
    DOCUMENT_ELEMENT = 'documentElement',
    DEFAULT_VIEW = 'defaultView',
    PARENT_WINDOW = 'parentWindow',
    TAG_NAME = 'tagName',
    PARENT_NODE = 'parentNode',
    PREVIOUS_SIBLING = 'previousSibling',
    NEXT_SIBLING = 'nextSibling',
    CONTAINS = 'contains',
    COMPARE_DOCUMENT_POSITION = 'compareDocumentPosition',
    EMPTY_ARRAY = [],

    // IE < 8 throws on node.contains(textNode)
    supportsContainsTextNode = (function() {
        var node = Y.config.doc.createElement('div'),
            textNode = node.appendChild(Y.config.doc.createTextNode('')),
            result = false;

        try {
            result = node.contains(textNode);
        } catch(e) {}

        return result;
    })(),

/**
 * The DOM utility provides a cross-browser abtraction layer
 * normalizing DOM tasks, and adds extra helper functionality
 * for other common tasks.
 * @module dom
 * @main dom
 * @submodule dom-base
 * @for DOM
 *
 */

/**
 * Provides DOM helper methods.
 * @class DOM
 *
 */

Y_DOM = {
    /**
     * Returns the HTMLElement with the given ID (Wrapper for document.getElementById).
     * @method byId
     * @param {String} id the id attribute
     * @param {Object} doc optional The document to search. Defaults to current document
     * @return {HTMLElement | null} The HTMLElement with the id, or null if none found.
     */
    byId: function(id, doc) {
        // handle dupe IDs and IE name collision
        return Y_DOM.allById(id, doc)[0] || null;
    },

    getId: function(node) {
        var id;
        // HTMLElement returned from FORM when INPUT name === "id"
        // IE < 8: HTMLCollection returned when INPUT id === "id"
        // via both getAttribute and form.id
        if (node.id && !node.id.tagName && !node.id.item) {
            id = node.id;
        } else if (node.attributes && node.attributes.id) {
            id = node.attributes.id.value;
        }

        return id;
    },

    setId: function(node, id) {
        if (node.setAttribute) {
            node.setAttribute('id', id);
        } else {
            node.id = id;
        }
    },

    /*
     * Finds the ancestor of the element.
     * @method ancestor
     * @param {HTMLElement} element The html element.
     * @param {Function} fn optional An optional boolean test to apply.
     * The optional function is passed the current DOM node being tested as its only argument.
     * If no function is given, the parentNode is returned.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan
     * @return {HTMLElement | null} The matching DOM node or null if none found.
     */
    ancestor: function(element, fn, testSelf, stopFn) {
        var ret = null;
        if (testSelf) {
            ret = (!fn || fn(element)) ? element : null;

        }
        return ret || Y_DOM.elementByAxis(element, PARENT_NODE, fn, null, stopFn);
    },

    /*
     * Finds the ancestors of the element.
     * @method ancestors
     * @param {HTMLElement} element The html element.
     * @param {Function} fn optional An optional boolean test to apply.
     * The optional function is passed the current DOM node being tested as its only argument.
     * If no function is given, all ancestors are returned.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan
     * @return {Array} An array containing all matching DOM nodes.
     */
    ancestors: function(element, fn, testSelf, stopFn) {
        var ancestor = element,
            ret = [];

        while ((ancestor = Y_DOM.ancestor(ancestor, fn, testSelf, stopFn))) {
            testSelf = false;
            if (ancestor) {
                ret.unshift(ancestor);

                if (stopFn && stopFn(ancestor)) {
                    return ret;
                }
            }
        }

        return ret;
    },

    /**
     * Searches the element by the given axis for the first matching element.
     * @method elementByAxis
     * @param {HTMLElement} element The html element.
     * @param {String} axis The axis to search (parentNode, nextSibling, previousSibling).
     * @param {Function} [fn] An optional boolean test to apply.
     * @param {Boolean} [all] Whether text nodes as well as element nodes should be returned, or
     * just element nodes will be returned(default)
     * The optional function is passed the current HTMLElement being tested as its only argument.
     * If no function is given, the first element is returned.
     * @return {HTMLElement | null} The matching element or null if none found.
     */
    elementByAxis: function(element, axis, fn, all, stopAt) {
        while (element && (element = element[axis])) { // NOTE: assignment
                if ( (all || element[TAG_NAME]) && (!fn || fn(element)) ) {
                    return element;
                }

                if (stopAt && stopAt(element)) {
                    return null;
                }
        }
        return null;
    },

    /**
     * Determines whether or not one HTMLElement is or contains another HTMLElement.
     * @method contains
     * @param {HTMLElement} element The containing html element.
     * @param {HTMLElement} needle The html element that may be contained.
     * @return {Boolean} Whether or not the element is or contains the needle.
     */
    contains: function(element, needle) {
        var ret = false;

        if ( !needle || !element || !needle[NODE_TYPE] || !element[NODE_TYPE]) {
            ret = false;
        } else if (element[CONTAINS] &&
                // IE < 8 throws on node.contains(textNode) so fall back to brute.
                // Falling back for other nodeTypes as well.
                (needle[NODE_TYPE] === 1 || supportsContainsTextNode)) {
                ret = element[CONTAINS](needle);
        } else if (element[COMPARE_DOCUMENT_POSITION]) {
            // Match contains behavior (node.contains(node) === true).
            // Needed for Firefox < 4.
            if (element === needle || !!(element[COMPARE_DOCUMENT_POSITION](needle) & 16)) {
                ret = true;
            }
        } else {
            ret = Y_DOM._bruteContains(element, needle);
        }

        return ret;
    },

    /**
     * Determines whether or not the HTMLElement is part of the document.
     * @method inDoc
     * @param {HTMLElement} element The containing html element.
     * @param {HTMLElement} doc optional The document to check.
     * @return {Boolean} Whether or not the element is attached to the document.
     */
    inDoc: function(element, doc) {
        var ret = false,
            rootNode;

        if (element && element.nodeType) {
            (doc) || (doc = element[OWNER_DOCUMENT]);

            rootNode = doc[DOCUMENT_ELEMENT];

            // contains only works with HTML_ELEMENT
            if (rootNode && rootNode.contains && element.tagName) {
                ret = rootNode.contains(element);
            } else {
                ret = Y_DOM.contains(rootNode, element);
            }
        }

        return ret;

    },

   allById: function(id, root) {
        root = root || Y.config.doc;
        var nodes = [],
            ret = [],
            i,
            node;

        if (root.querySelectorAll) {
            ret = root.querySelectorAll('[id="' + id + '"]');
        } else if (root.all) {
            nodes = root.all(id);

            if (nodes) {
                // root.all may return HTMLElement or HTMLCollection.
                // some elements are also HTMLCollection (FORM, SELECT).
                if (nodes.nodeName) {
                    if (nodes.id === id) { // avoid false positive on name
                        ret.push(nodes);
                        nodes = EMPTY_ARRAY; // done, no need to filter
                    } else { //  prep for filtering
                        nodes = [nodes];
                    }
                }

                if (nodes.length) {
                    // filter out matches on node.name
                    // and element.id as reference to element with id === 'id'
                    for (i = 0; node = nodes[i++];) {
                        if (node.id === id  ||
                                (node.attributes && node.attributes.id &&
                                node.attributes.id.value === id)) {
                            ret.push(node);
                        }
                    }
                }
            }
        } else {
            ret = [Y_DOM._getDoc(root).getElementById(id)];
        }

        return ret;
   },


    isWindow: function(obj) {
        return !!(obj && obj.scrollTo && obj.document);
    },

    _removeChildNodes: function(node) {
        while (node.firstChild) {
            node.removeChild(node.firstChild);
        }
    },

    siblings: function(node, fn) {
        var nodes = [],
            sibling = node;

        while ((sibling = sibling[PREVIOUS_SIBLING])) {
            if (sibling[TAG_NAME] && (!fn || fn(sibling))) {
                nodes.unshift(sibling);
            }
        }

        sibling = node;
        while ((sibling = sibling[NEXT_SIBLING])) {
            if (sibling[TAG_NAME] && (!fn || fn(sibling))) {
                nodes.push(sibling);
            }
        }

        return nodes;
    },

    /**
     * Brute force version of contains.
     * Used for browsers without contains support for non-HTMLElement Nodes (textNodes, etc).
     * @method _bruteContains
     * @private
     * @param {HTMLElement} element The containing html element.
     * @param {HTMLElement} needle The html element that may be contained.
     * @return {Boolean} Whether or not the element is or contains the needle.
     */
    _bruteContains: function(element, needle) {
        while (needle) {
            if (element === needle) {
                return true;
            }
            needle = needle.parentNode;
        }
        return false;
    },

// TODO: move to Lang?
    /**
     * Memoizes dynamic regular expressions to boost runtime performance.
     * @method _getRegExp
     * @private
     * @param {String} str The string to convert to a regular expression.
     * @param {String} flags optional An optinal string of flags.
     * @return {RegExp} An instance of RegExp
     */
    _getRegExp: function(str, flags) {
        flags = flags || '';
        Y_DOM._regexCache = Y_DOM._regexCache || {};
        if (!Y_DOM._regexCache[str + flags]) {
            Y_DOM._regexCache[str + flags] = new RegExp(str, flags);
        }
        return Y_DOM._regexCache[str + flags];
    },

// TODO: make getDoc/Win true privates?
    /**
     * returns the appropriate document.
     * @method _getDoc
     * @private
     * @param {HTMLElement} element optional Target element.
     * @return {Object} The document for the given element or the default document.
     */
    _getDoc: function(element) {
        var doc = Y.config.doc;
        if (element) {
            doc = (element[NODE_TYPE] === 9) ? element : // element === document
                element[OWNER_DOCUMENT] || // element === DOM node
                element.document || // element === window
                Y.config.doc; // default
        }

        return doc;
    },

    /**
     * returns the appropriate window.
     * @method _getWin
     * @private
     * @param {HTMLElement} element optional Target element.
     * @return {Object} The window for the given element or the default window.
     */
    _getWin: function(element) {
        var doc = Y_DOM._getDoc(element);
        return doc[DEFAULT_VIEW] || doc[PARENT_WINDOW] || Y.config.win;
    },

    _batch: function(nodes, fn, arg1, arg2, arg3, etc) {
        fn = (typeof fn === 'string') ? Y_DOM[fn] : fn;
        var result,
            i = 0,
            node,
            ret;

        if (fn && nodes) {
            while ((node = nodes[i++])) {
                result = result = fn.call(Y_DOM, node, arg1, arg2, arg3, etc);
                if (typeof result !== 'undefined') {
                    (ret) || (ret = []);
                    ret.push(result);
                }
            }
        }

        return (typeof ret !== 'undefined') ? ret : nodes;
    },

    generateID: function(el) {
        var id = el.id;

        if (!id) {
            id = Y.stamp(el);
            el.id = id;
        }

        return id;
    }
};


Y.DOM = Y_DOM;


}, '3.17.1', {"requires": ["oop", "features"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('dom-base', function (Y, NAME) {

/**
* @for DOM
* @module dom
*/
var documentElement = Y.config.doc.documentElement,
    Y_DOM = Y.DOM,
    TAG_NAME = 'tagName',
    OWNER_DOCUMENT = 'ownerDocument',
    EMPTY_STRING = '',
    addFeature = Y.Features.add,
    testFeature = Y.Features.test;

Y.mix(Y_DOM, {
    /**
     * Returns the text content of the HTMLElement.
     * @method getText
     * @param {HTMLElement} element The html element.
     * @return {String} The text content of the element (includes text of any descending elements).
     */
    getText: (documentElement.textContent !== undefined) ?
        function(element) {
            var ret = '';
            if (element) {
                ret = element.textContent;
            }
            return ret || '';
        } : function(element) {
            var ret = '';
            if (element) {
                ret = element.innerText || element.nodeValue; // might be a textNode
            }
            return ret || '';
        },

    /**
     * Sets the text content of the HTMLElement.
     * @method setText
     * @param {HTMLElement} element The html element.
     * @param {String} content The content to add.
     */
    setText: (documentElement.textContent !== undefined) ?
        function(element, content) {
            if (element) {
                element.textContent = content;
            }
        } : function(element, content) {
            if ('innerText' in element) {
                element.innerText = content;
            } else if ('nodeValue' in element) {
                element.nodeValue = content;
            }
    },

    CUSTOM_ATTRIBUTES: (!documentElement.hasAttribute) ? { // IE < 8
        'for': 'htmlFor',
        'class': 'className'
    } : { // w3c
        'htmlFor': 'for',
        'className': 'class'
    },

    /**
     * Provides a normalized attribute interface.
     * @method setAttribute
     * @param {HTMLElement} el The target element for the attribute.
     * @param {String} attr The attribute to set.
     * @param {String} val The value of the attribute.
     */
    setAttribute: function(el, attr, val, ieAttr) {
        if (el && attr && el.setAttribute) {
            attr = Y_DOM.CUSTOM_ATTRIBUTES[attr] || attr;
            el.setAttribute(attr, val, ieAttr);
        }
    },


    /**
     * Provides a normalized attribute interface.
     * @method getAttribute
     * @param {HTMLElement} el The target element for the attribute.
     * @param {String} attr The attribute to get.
     * @return {String} The current value of the attribute.
     */
    getAttribute: function(el, attr, ieAttr) {
        ieAttr = (ieAttr !== undefined) ? ieAttr : 2;
        var ret = '';
        if (el && attr && el.getAttribute) {
            attr = Y_DOM.CUSTOM_ATTRIBUTES[attr] || attr;
            // BUTTON value issue for IE < 8
            ret = (el.tagName === "BUTTON" && attr === 'value') ? Y_DOM.getValue(el) : el.getAttribute(attr, ieAttr);

            if (ret === null) {
                ret = ''; // per DOM spec
            }
        }
        return ret;
    },

    VALUE_SETTERS: {},

    VALUE_GETTERS: {},

    getValue: function(node) {
        var ret = '', // TODO: return null?
            getter;

        if (node && node[TAG_NAME]) {
            getter = Y_DOM.VALUE_GETTERS[node[TAG_NAME].toLowerCase()];

            if (getter) {
                ret = getter(node);
            } else {
                ret = node.value;
            }
        }

        // workaround for IE8 JSON stringify bug
        // which converts empty string values to null
        if (ret === EMPTY_STRING) {
            ret = EMPTY_STRING; // for real
        }

        return (typeof ret === 'string') ? ret : '';
    },

    setValue: function(node, val) {
        var setter;

        if (node && node[TAG_NAME]) {
            setter = Y_DOM.VALUE_SETTERS[node[TAG_NAME].toLowerCase()];
            val = (val === null) ? '' : val;
            if (setter) {
                setter(node, val);
            } else {
                node.value = val;
            }
        }
    },

    creators: {}
});

addFeature('value-set', 'select', {
    test: function() {
        var node = Y.config.doc.createElement('select');
        node.innerHTML = '<option>1</option><option>2</option>';
        node.value = '2';
        return (node.value && node.value === '2');
    }
});

if (!testFeature('value-set', 'select')) {
    Y_DOM.VALUE_SETTERS.select = function(node, val) {
        for (var i = 0, options = node.getElementsByTagName('option'), option;
                option = options[i++];) {
            if (Y_DOM.getValue(option) === val) {
                option.selected = true;
                //Y_DOM.setAttribute(option, 'selected', 'selected');
                break;
            }
        }
    };
}

Y.mix(Y_DOM.VALUE_GETTERS, {
    button: function(node) {
        return (node.attributes && node.attributes.value) ? node.attributes.value.value : '';
    }
});

Y.mix(Y_DOM.VALUE_SETTERS, {
    // IE: node.value changes the button text, which should be handled via innerHTML
    button: function(node, val) {
        var attr = node.attributes.value;
        if (!attr) {
            attr = node[OWNER_DOCUMENT].createAttribute('value');
            node.setAttributeNode(attr);
        }

        attr.value = val;
    }
});


Y.mix(Y_DOM.VALUE_GETTERS, {
    option: function(node) {
        var attrs = node.attributes;
        return (attrs.value && attrs.value.specified) ? node.value : node.text;
    },

    select: function(node) {
        var val = node.value,
            options = node.options;

        if (options && options.length) {
            // TODO: implement multipe select
            if (node.multiple) {
            } else if (node.selectedIndex > -1) {
                val = Y_DOM.getValue(options[node.selectedIndex]);
            }
        }

        return val;
    }
});
var addClass, hasClass, removeClass;

Y.mix(Y.DOM, {
    /**
     * Determines whether a DOM element has the given className.
     * @method hasClass
     * @for DOM
     * @param {HTMLElement} element The DOM element.
     * @param {String} className the class name to search for
     * @return {Boolean} Whether or not the element has the given class.
     */
    hasClass: function(node, className) {
        var re = Y.DOM._getRegExp('(?:^|\\s+)' + className + '(?:\\s+|$)');
        return re.test(node.className);
    },

    /**
     * Adds a class name to a given DOM element.
     * @method addClass
     * @for DOM
     * @param {HTMLElement} element The DOM element.
     * @param {String} className the class name to add to the class attribute
     */
    addClass: function(node, className) {
        if (!Y.DOM.hasClass(node, className)) { // skip if already present
            node.className = Y.Lang.trim([node.className, className].join(' '));
        }
    },

    /**
     * Removes a class name from a given element.
     * @method removeClass
     * @for DOM
     * @param {HTMLElement} element The DOM element.
     * @param {String} className the class name to remove from the class attribute
     */
    removeClass: function(node, className) {
        if (className && hasClass(node, className)) {
            node.className = Y.Lang.trim(node.className.replace(Y.DOM._getRegExp('(?:^|\\s+)' +
                            className + '(?:\\s+|$)'), ' '));

            if ( hasClass(node, className) ) { // in case of multiple adjacent
                removeClass(node, className);
            }
        }
    },

    /**
     * Replace a class with another class for a given element.
     * If no oldClassName is present, the newClassName is simply added.
     * @method replaceClass
     * @for DOM
     * @param {HTMLElement} element The DOM element
     * @param {String} oldClassName the class name to be replaced
     * @param {String} newClassName the class name that will be replacing the old class name
     */
    replaceClass: function(node, oldC, newC) {
        removeClass(node, oldC); // remove first in case oldC === newC
        addClass(node, newC);
    },

    /**
     * If the className exists on the node it is removed, if it doesn't exist it is added.
     * @method toggleClass
     * @for DOM
     * @param {HTMLElement} element The DOM element
     * @param {String} className the class name to be toggled
     * @param {Boolean} addClass optional boolean to indicate whether class
     * should be added or removed regardless of current state
     */
    toggleClass: function(node, className, force) {
        var add = (force !== undefined) ? force :
                !(hasClass(node, className));

        if (add) {
            addClass(node, className);
        } else {
            removeClass(node, className);
        }
    }
});

hasClass = Y.DOM.hasClass;
removeClass = Y.DOM.removeClass;
addClass = Y.DOM.addClass;

var re_tag = /<([a-z]+)/i,

    Y_DOM = Y.DOM,

    addFeature = Y.Features.add,
    testFeature = Y.Features.test,

    creators = {},

    createFromDIV = function(html, tag) {
        var div = Y.config.doc.createElement('div'),
            ret = true;

        div.innerHTML = html;
        if (!div.firstChild || div.firstChild.tagName !== tag.toUpperCase()) {
            ret = false;
        }

        return ret;
    },

    re_tbody = /(?:\/(?:thead|tfoot|tbody|caption|col|colgroup)>)+\s*<tbody/,

    TABLE_OPEN = '<table>',
    TABLE_CLOSE = '</table>',

    selectedIndex;

Y.mix(Y.DOM, {
    _fragClones: {},

    _create: function(html, doc, tag) {
        tag = tag || 'div';

        var frag = Y_DOM._fragClones[tag];
        if (frag) {
            frag = frag.cloneNode(false);
        } else {
            frag = Y_DOM._fragClones[tag] = doc.createElement(tag);
        }
        frag.innerHTML = html;
        return frag;
    },

    _children: function(node, tag) {
            var i = 0,
            children = node.children,
            childNodes,
            hasComments,
            child;

        if (children && children.tags) { // use tags filter when possible
            if (tag) {
                children = node.children.tags(tag);
            } else { // IE leaks comments into children
                hasComments = children.tags('!').length;
            }
        }

        if (!children || (!children.tags && tag) || hasComments) {
            childNodes = children || node.childNodes;
            children = [];
            while ((child = childNodes[i++])) {
                if (child.nodeType === 1) {
                    if (!tag || tag === child.tagName) {
                        children.push(child);
                    }
                }
            }
        }

        return children || [];
    },

    /**
     * Creates a new dom node using the provided markup string.
     * @method create
     * @param {String} html The markup used to create the element
     * @param {HTMLDocument} doc An optional document context
     * @return {HTMLElement|DocumentFragment} returns a single HTMLElement
     * when creating one node, and a documentFragment when creating
     * multiple nodes.
     */
    create: function(html, doc) {
        if (typeof html === 'string') {
            html = Y.Lang.trim(html); // match IE which trims whitespace from innerHTML

        }

        doc = doc || Y.config.doc;
        var m = re_tag.exec(html),
            create = Y_DOM._create,
            custom = creators,
            ret = null,
            creator, tag, node, nodes;

        if (html != undefined) { // not undefined or null
            if (m && m[1]) {
                creator = custom[m[1].toLowerCase()];
                if (typeof creator === 'function') {
                    create = creator;
                } else {
                    tag = creator;
                }
            }

            node = create(html, doc, tag);
            nodes = node.childNodes;

            if (nodes.length === 1) { // return single node, breaking parentNode ref from "fragment"
                ret = node.removeChild(nodes[0]);
            } else if (nodes[0] && nodes[0].className === 'yui3-big-dummy') { // using dummy node to preserve some attributes (e.g. OPTION not selected)
                selectedIndex = node.selectedIndex;

                if (nodes.length === 2) {
                    ret = nodes[0].nextSibling;
                } else {
                    node.removeChild(nodes[0]);
                    ret = Y_DOM._nl2frag(nodes, doc);
                }
            } else { // return multiple nodes as a fragment
                 ret = Y_DOM._nl2frag(nodes, doc);
            }

        }

        return ret;
    },

    _nl2frag: function(nodes, doc) {
        var ret = null,
            i, len;

        if (nodes && (nodes.push || nodes.item) && nodes[0]) {
            doc = doc || nodes[0].ownerDocument;
            ret = doc.createDocumentFragment();

            if (nodes.item) { // convert live list to static array
                nodes = Y.Array(nodes, 0, true);
            }

            for (i = 0, len = nodes.length; i < len; i++) {
                ret.appendChild(nodes[i]);
            }
        } // else inline with log for minification
        return ret;
    },

    /**
     * Inserts content in a node at the given location
     * @method addHTML
     * @param {HTMLElement} node The node to insert into
     * @param {HTMLElement | Array | HTMLCollection} content The content to be inserted
     * @param {HTMLElement} where Where to insert the content
     * If no "where" is given, content is appended to the node
     * Possible values for "where"
     * <dl>
     * <dt>HTMLElement</dt>
     * <dd>The element to insert before</dd>
     * <dt>"replace"</dt>
     * <dd>Replaces the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts before the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts content before the node</dd>
     * <dt>"after"</dt>
     * <dd>Inserts content after the node</dd>
     * </dl>
     */
    addHTML: function(node, content, where) {
        var nodeParent = node.parentNode,
            i = 0,
            item,
            ret = content,
            newNode;


        if (content != undefined) { // not null or undefined (maybe 0)
            if (content.nodeType) { // DOM node, just add it
                newNode = content;
            } else if (typeof content == 'string' || typeof content == 'number') {
                ret = newNode = Y_DOM.create(content);
            } else if (content[0] && content[0].nodeType) { // array or collection
                newNode = Y.config.doc.createDocumentFragment();
                while ((item = content[i++])) {
                    newNode.appendChild(item); // append to fragment for insertion
                }
            }
        }

        if (where) {
            if (newNode && where.parentNode) { // insert regardless of relationship to node
                where.parentNode.insertBefore(newNode, where);
            } else {
                switch (where) {
                    case 'replace':
                        while (node.firstChild) {
                            node.removeChild(node.firstChild);
                        }
                        if (newNode) { // allow empty content to clear node
                            node.appendChild(newNode);
                        }
                        break;
                    case 'before':
                        if (newNode) {
                            nodeParent.insertBefore(newNode, node);
                        }
                        break;
                    case 'after':
                        if (newNode) {
                            if (node.nextSibling) { // IE errors if refNode is null
                                nodeParent.insertBefore(newNode, node.nextSibling);
                            } else {
                                nodeParent.appendChild(newNode);
                            }
                        }
                        break;
                    default:
                        if (newNode) {
                            node.appendChild(newNode);
                        }
                }
            }
        } else if (newNode) {
            node.appendChild(newNode);
        }

        // `select` elements are the only elements with `selectedIndex`.
        // Don't grab the dummy `option` element's `selectedIndex`.
        if (node.nodeName == "SELECT" && selectedIndex > 0) {
            node.selectedIndex = selectedIndex - 1;
        }

        return ret;
    },

    wrap: function(node, html) {
        var parent = (html && html.nodeType) ? html : Y.DOM.create(html),
            nodes = parent.getElementsByTagName('*');

        if (nodes.length) {
            parent = nodes[nodes.length - 1];
        }

        if (node.parentNode) {
            node.parentNode.replaceChild(parent, node);
        }
        parent.appendChild(node);
    },

    unwrap: function(node) {
        var parent = node.parentNode,
            lastChild = parent.lastChild,
            next = node,
            grandparent;

        if (parent) {
            grandparent = parent.parentNode;
            if (grandparent) {
                node = parent.firstChild;
                while (node !== lastChild) {
                    next = node.nextSibling;
                    grandparent.insertBefore(node, parent);
                    node = next;
                }
                grandparent.replaceChild(lastChild, parent);
            } else {
                parent.removeChild(node);
            }
        }
    }
});

addFeature('innerhtml', 'table', {
    test: function() {
        var node = Y.config.doc.createElement('table');
        try {
            node.innerHTML = '<tbody></tbody>';
        } catch(e) {
            return false;
        }
        return (node.firstChild && node.firstChild.nodeName === 'TBODY');
    }
});

addFeature('innerhtml-div', 'tr', {
    test: function() {
        return createFromDIV('<tr></tr>', 'tr');
    }
});

addFeature('innerhtml-div', 'script', {
    test: function() {
        return createFromDIV('<script></script>', 'script');
    }
});

if (!testFeature('innerhtml', 'table')) {
    // TODO: thead/tfoot with nested tbody
        // IE adds TBODY when creating TABLE elements (which may share this impl)
    creators.tbody = function(html, doc) {
        var frag = Y_DOM.create(TABLE_OPEN + html + TABLE_CLOSE, doc),
            tb = Y.DOM._children(frag, 'tbody')[0];

        if (frag.children.length > 1 && tb && !re_tbody.test(html)) {
            tb.parentNode.removeChild(tb); // strip extraneous tbody
        }
        return frag;
    };
}

if (!testFeature('innerhtml-div', 'script')) {
    creators.script = function(html, doc) {
        var frag = doc.createElement('div');

        frag.innerHTML = '-' + html;
        frag.removeChild(frag.firstChild);
        return frag;
    };

    creators.link = creators.style = creators.script;
}

if (!testFeature('innerhtml-div', 'tr')) {
    Y.mix(creators, {
        option: function(html, doc) {
            return Y_DOM.create('<select><option class="yui3-big-dummy" selected></option>' + html + '</select>', doc);
        },

        tr: function(html, doc) {
            return Y_DOM.create('<tbody>' + html + '</tbody>', doc);
        },

        td: function(html, doc) {
            return Y_DOM.create('<tr>' + html + '</tr>', doc);
        },

        col: function(html, doc) {
            return Y_DOM.create('<colgroup>' + html + '</colgroup>', doc);
        },

        tbody: 'table'
    });

    Y.mix(creators, {
        legend: 'fieldset',
        th: creators.td,
        thead: creators.tbody,
        tfoot: creators.tbody,
        caption: creators.tbody,
        colgroup: creators.tbody,
        optgroup: creators.option
    });
}

Y_DOM.creators = creators;
Y.mix(Y.DOM, {
    /**
     * Sets the width of the element to the given size, regardless
     * of box model, border, padding, etc.
     * @method setWidth
     * @param {HTMLElement} element The DOM element.
     * @param {String|Number} size The pixel height to size to
     */

    setWidth: function(node, size) {
        Y.DOM._setSize(node, 'width', size);
    },

    /**
     * Sets the height of the element to the given size, regardless
     * of box model, border, padding, etc.
     * @method setHeight
     * @param {HTMLElement} element The DOM element.
     * @param {String|Number} size The pixel height to size to
     */

    setHeight: function(node, size) {
        Y.DOM._setSize(node, 'height', size);
    },

    _setSize: function(node, prop, val) {
        val = (val > 0) ? val : 0;
        var size = 0;

        node.style[prop] = val + 'px';
        size = (prop === 'height') ? node.offsetHeight : node.offsetWidth;

        if (size > val) {
            val = val - (size - val);

            if (val < 0) {
                val = 0;
            }

            node.style[prop] = val + 'px';
        }
    }
});


}, '3.17.1', {"requires": ["dom-core"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('selector-native', function (Y, NAME) {

(function(Y) {
/**
 * The selector-native module provides support for native querySelector
 * @module dom
 * @submodule selector-native
 * @for Selector
 */

/**
 * Provides support for using CSS selectors to query the DOM
 * @class Selector
 * @static
 * @for Selector
 */

Y.namespace('Selector'); // allow native module to standalone

var COMPARE_DOCUMENT_POSITION = 'compareDocumentPosition',
    OWNER_DOCUMENT = 'ownerDocument';

var Selector = {
    _types: {
        esc: {
            token: '\uE000',
            re: /\\[:\[\]\(\)#\.\'\>+~"]/gi
        },

        attr: {
            token: '\uE001',
            re: /(\[[^\]]*\])/g
        },

        pseudo: {
            token: '\uE002',
            re: /(\([^\)]*\))/g
        }
    },

    /**
     *  Use the native version of `querySelectorAll`, if it exists.
     *
     * @property useNative
     * @default true
     * @static
     */
    useNative: true,

    _escapeId: function(id) {
        if (id) {
            id = id.replace(/([:\[\]\(\)#\.'<>+~"])/g,'\\$1');
        }
        return id;
    },

    _compare: ('sourceIndex' in Y.config.doc.documentElement) ?
        function(nodeA, nodeB) {
            var a = nodeA.sourceIndex,
                b = nodeB.sourceIndex;

            if (a === b) {
                return 0;
            } else if (a > b) {
                return 1;
            }

            return -1;

        } : (Y.config.doc.documentElement[COMPARE_DOCUMENT_POSITION] ?
        function(nodeA, nodeB) {
            if (nodeA[COMPARE_DOCUMENT_POSITION](nodeB) & 4) {
                return -1;
            } else {
                return 1;
            }
        } :
        function(nodeA, nodeB) {
            var rangeA, rangeB, compare;
            if (nodeA && nodeB) {
                rangeA = nodeA[OWNER_DOCUMENT].createRange();
                rangeA.setStart(nodeA, 0);
                rangeB = nodeB[OWNER_DOCUMENT].createRange();
                rangeB.setStart(nodeB, 0);
                compare = rangeA.compareBoundaryPoints(1, rangeB); // 1 === Range.START_TO_END
            }

            return compare;

    }),

    _sort: function(nodes) {
        if (nodes) {
            nodes = Y.Array(nodes, 0, true);
            if (nodes.sort) {
                nodes.sort(Selector._compare);
            }
        }

        return nodes;
    },

    _deDupe: function(nodes) {
        var ret = [],
            i, node;

        for (i = 0; (node = nodes[i++]);) {
            if (!node._found) {
                ret[ret.length] = node;
                node._found = true;
            }
        }

        for (i = 0; (node = ret[i++]);) {
            node._found = null;
            node.removeAttribute('_found');
        }

        return ret;
    },

    /**
     * Retrieves a set of nodes based on a given CSS selector.
     * @method query
     *
     * @param {String} selector A CSS selector.
     * @param {HTMLElement} root optional A node to start the query from. Defaults to `Y.config.doc`.
     * @param {Boolean} firstOnly optional Whether or not to return only the first match.
     * @return {HTMLElement[]} The array of nodes that matched the given selector.
     * @static
     */
    query: function(selector, root, firstOnly, skipNative) {
        root = root || Y.config.doc;
        var ret = [],
            useNative = (Y.Selector.useNative && Y.config.doc.querySelector && !skipNative),
            queries = [[selector, root]],
            query,
            result,
            i,
            fn = (useNative) ? Y.Selector._nativeQuery : Y.Selector._bruteQuery;

        if (selector && fn) {
            // split group into seperate queries
            if (!skipNative && // already done if skipping
                    (!useNative || root.tagName)) { // split native when element scoping is needed
                queries = Selector._splitQueries(selector, root);
            }

            for (i = 0; (query = queries[i++]);) {
                result = fn(query[0], query[1], firstOnly);
                if (!firstOnly) { // coerce DOM Collection to Array
                    result = Y.Array(result, 0, true);
                }
                if (result) {
                    ret = ret.concat(result);
                }
            }

            if (queries.length > 1) { // remove dupes and sort by doc order
                ret = Selector._sort(Selector._deDupe(ret));
            }
        }

        return (firstOnly) ? (ret[0] || null) : ret;

    },

    _replaceSelector: function(selector) {
        var esc = Y.Selector._parse('esc', selector), // pull escaped colon, brackets, etc.
            attrs,
            pseudos;

        // first replace escaped chars, which could be present in attrs or pseudos
        selector = Y.Selector._replace('esc', selector);

        // then replace pseudos before attrs to avoid replacing :not([foo])
        pseudos = Y.Selector._parse('pseudo', selector);
        selector = Selector._replace('pseudo', selector);

        attrs = Y.Selector._parse('attr', selector);
        selector = Y.Selector._replace('attr', selector);

        return {
            esc: esc,
            attrs: attrs,
            pseudos: pseudos,
            selector: selector
        };
    },

    _restoreSelector: function(replaced) {
        var selector = replaced.selector;
        selector = Y.Selector._restore('attr', selector, replaced.attrs);
        selector = Y.Selector._restore('pseudo', selector, replaced.pseudos);
        selector = Y.Selector._restore('esc', selector, replaced.esc);
        return selector;
    },

    _replaceCommas: function(selector) {
        var replaced = Y.Selector._replaceSelector(selector),
            selector = replaced.selector;

        if (selector) {
            selector = selector.replace(/,/g, '\uE007');
            replaced.selector = selector;
            selector = Y.Selector._restoreSelector(replaced);
        }
        return selector;
    },

    // allows element scoped queries to begin with combinator
    // e.g. query('> p', document.body) === query('body > p')
    _splitQueries: function(selector, node) {
        if (selector.indexOf(',') > -1) {
            selector = Y.Selector._replaceCommas(selector);
        }

        var groups = selector.split('\uE007'), // split on replaced comma token
            queries = [],
            prefix = '',
            id,
            i,
            len;

        if (node) {
            // enforce for element scoping
            if (node.nodeType === 1) { // Elements only
                id = Y.Selector._escapeId(Y.DOM.getId(node));

                if (!id) {
                    id = Y.guid();
                    Y.DOM.setId(node, id);
                }

                prefix = '[id="' + id + '"] ';
            }

            for (i = 0, len = groups.length; i < len; ++i) {
                selector =  prefix + groups[i];
                queries.push([selector, node]);
            }
        }

        return queries;
    },

    _nativeQuery: function(selector, root, one) {
        if (
            (Y.UA.webkit || Y.UA.opera) &&          // webkit (chrome, safari) and Opera
            selector.indexOf(':checked') > -1 &&    // fail to pick up "selected"  with ":checked"
            (Y.Selector.pseudos && Y.Selector.pseudos.checked)
        ) {
            return Y.Selector.query(selector, root, one, true); // redo with skipNative true to try brute query
        }
        try {
            return root['querySelector' + (one ? '' : 'All')](selector);
        } catch(e) { // fallback to brute if available
            return Y.Selector.query(selector, root, one, true); // redo with skipNative true
        }
    },

    /**
     * Filters out nodes that do not match the given CSS selector.
     * @method filter
     *
     * @param {HTMLElement[]} nodes An array of nodes.
     * @param {String} selector A CSS selector to test each node against.
     * @return {HTMLElement[]} The nodes that matched the given CSS selector.
     * @static
     */
    filter: function(nodes, selector) {
        var ret = [],
            i, node;

        if (nodes && selector) {
            for (i = 0; (node = nodes[i++]);) {
                if (Y.Selector.test(node, selector)) {
                    ret[ret.length] = node;
                }
            }
        } else {
        }

        return ret;
    },

    /**
     * Determines whether or not the given node matches the given CSS selector.
     * @method test
     * 
     * @param {HTMLElement} node A node to test.
     * @param {String} selector A CSS selector to test the node against.
     * @param {HTMLElement} root optional A node to start the query from. Defaults to the parent document of the node.
     * @return {Boolean} Whether or not the given node matched the given CSS selector.
     * @static
     */
    test: function(node, selector, root) {
        var ret = false,
            useFrag = false,
            groups,
            parent,
            item,
            items,
            frag,
            id,
            i, j, group;

        if (node && node.tagName) { // only test HTMLElements

            if (typeof selector == 'function') { // test with function
                ret = selector.call(node, node);
            } else { // test with query
                // we need a root if off-doc
                groups = selector.split(',');
                if (!root && !Y.DOM.inDoc(node)) {
                    parent = node.parentNode;
                    if (parent) {
                        root = parent;
                    } else { // only use frag when no parent to query
                        frag = node[OWNER_DOCUMENT].createDocumentFragment();
                        frag.appendChild(node);
                        root = frag;
                        useFrag = true;
                    }
                }
                root = root || node[OWNER_DOCUMENT];

                id = Y.Selector._escapeId(Y.DOM.getId(node));
                if (!id) {
                    id = Y.guid();
                    Y.DOM.setId(node, id);
                }

                for (i = 0; (group = groups[i++]);) { // TODO: off-dom test
                    group += '[id="' + id + '"]';
                    items = Y.Selector.query(group, root);

                    for (j = 0; item = items[j++];) {
                        if (item === node) {
                            ret = true;
                            break;
                        }
                    }
                    if (ret) {
                        break;
                    }
                }

                if (useFrag) { // cleanup
                    frag.removeChild(node);
                }
            };
        }

        return ret;
    },

    /**
     * A convenience method to emulate Y.Node's aNode.ancestor(selector).
     * @method ancestor
     *
     * @param {HTMLElement} node A node to start the query from.
     * @param {String} selector A CSS selector to test the node against.
     * @param {Boolean} testSelf optional Whether or not to include the node in the scan.
     * @return {HTMLElement} The ancestor node matching the selector, or null.
     * @static
     */
    ancestor: function (node, selector, testSelf) {
        return Y.DOM.ancestor(node, function(n) {
            return Y.Selector.test(n, selector);
        }, testSelf);
    },

    _parse: function(name, selector) {
        return selector.match(Y.Selector._types[name].re);
    },

    _replace: function(name, selector) {
        var o = Y.Selector._types[name];
        return selector.replace(o.re, o.token);
    },

    _restore: function(name, selector, items) {
        if (items) {
            var token = Y.Selector._types[name].token,
                i, len;
            for (i = 0, len = items.length; i < len; ++i) {
                selector = selector.replace(token, items[i]);
            }
        }
        return selector;
    }
};

Y.mix(Y.Selector, Selector, true);

})(Y);


}, '3.17.1', {"requires": ["dom-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('selector', function (Y, NAME) {



}, '3.17.1', {"requires": ["selector-native"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-core', function (Y, NAME) {

/**
 * The Node Utility provides a DOM-like interface for interacting with DOM nodes.
 * @module node
 * @main node
 * @submodule node-core
 */

/**
 * The Node class provides a wrapper for manipulating DOM Nodes.
 * Node properties can be accessed via the set/get methods.
 * Use `Y.one()` to retrieve Node instances.
 *
 * <strong>NOTE:</strong> Node properties are accessed using
 * the <code>set</code> and <code>get</code> methods.
 *
 * @class Node
 * @constructor
 * @param {HTMLElement} node the DOM node to be mapped to the Node instance.
 * @uses EventTarget
 */

// "globals"
var DOT = '.',
    NODE_NAME = 'nodeName',
    NODE_TYPE = 'nodeType',
    OWNER_DOCUMENT = 'ownerDocument',
    TAG_NAME = 'tagName',
    UID = '_yuid',
    EMPTY_OBJ = {},

    _slice = Array.prototype.slice,

    Y_DOM = Y.DOM,

    Y_Node = function(node) {
        if (!this.getDOMNode) { // support optional "new"
            return new Y_Node(node);
        }

        if (typeof node == 'string') {
            node = Y_Node._fromString(node);
            if (!node) {
                return null; // NOTE: return
            }
        }

        var uid = (node.nodeType !== 9) ? node.uniqueID : node[UID];

        if (uid && Y_Node._instances[uid] && Y_Node._instances[uid]._node !== node) {
            node[UID] = null; // unset existing uid to prevent collision (via clone or hack)
        }

        uid = uid || Y.stamp(node);
        if (!uid) { // stamp failed; likely IE non-HTMLElement
            uid = Y.guid();
        }

        this[UID] = uid;

        /**
         * The underlying DOM node bound to the Y.Node instance
         * @property _node
         * @type HTMLElement
         * @private
         */
        this._node = node;

        this._stateProxy = node; // when augmented with Attribute

        if (this._initPlugins) { // when augmented with Plugin.Host
            this._initPlugins();
        }
    },

    // used with previous/next/ancestor tests
    _wrapFn = function(fn) {
        var ret = null;
        if (fn) {
            ret = (typeof fn == 'string') ?
            function(n) {
                return Y.Selector.test(n, fn);
            } :
            function(n) {
                return fn(Y.one(n));
            };
        }

        return ret;
    };
// end "globals"

Y_Node.ATTRS = {};
Y_Node.DOM_EVENTS = {};

Y_Node._fromString = function(node) {
    if (node) {
        if (node.indexOf('doc') === 0) { // doc OR document
            node = Y.config.doc;
        } else if (node.indexOf('win') === 0) { // win OR window
            node = Y.config.win;
        } else {
            node = Y.Selector.query(node, null, true);
        }
    }

    return node || null;
};

/**
 * The name of the component
 * @static
 * @type String
 * @property NAME
 */
Y_Node.NAME = 'node';

/*
 * The pattern used to identify ARIA attributes
 */
Y_Node.re_aria = /^(?:role$|aria-)/;

Y_Node.SHOW_TRANSITION = 'fadeIn';
Y_Node.HIDE_TRANSITION = 'fadeOut';

/**
 * A list of Node instances that have been created
 * @private
 * @type Object
 * @property _instances
 * @static
 *
 */
Y_Node._instances = {};

/**
 * Retrieves the DOM node bound to a Node instance
 * @method getDOMNode
 * @static
 *
 * @param {Node|HTMLElement} node The Node instance or an HTMLElement
 * @return {HTMLElement} The DOM node bound to the Node instance.  If a DOM node is passed
 * as the node argument, it is simply returned.
 */
Y_Node.getDOMNode = function(node) {
    if (node) {
        return (node.nodeType) ? node : node._node || null;
    }
    return null;
};

/**
 * Checks Node return values and wraps DOM Nodes as Y.Node instances
 * and DOM Collections / Arrays as Y.NodeList instances.
 * Other return values just pass thru.  If undefined is returned (e.g. no return)
 * then the Node instance is returned for chainability.
 * @method scrubVal
 * @static
 *
 * @param {HTMLElement|HTMLElement[]|Node} node The Node instance or an HTMLElement
 * @return {Node | NodeList | Any} Depends on what is returned from the DOM node.
 */
Y_Node.scrubVal = function(val, node) {
    if (val) { // only truthy values are risky
         if (typeof val == 'object' || typeof val == 'function') { // safari nodeList === function
            if (NODE_TYPE in val || Y_DOM.isWindow(val)) {// node || window
                val = Y.one(val);
            } else if ((val.item && !val._nodes) || // dom collection or Node instance
                    (val[0] && val[0][NODE_TYPE])) { // array of DOM Nodes
                val = Y.all(val);
            }
        }
    } else if (typeof val === 'undefined') {
        val = node; // for chaining
    } else if (val === null) {
        val = null; // IE: DOM null not the same as null
    }

    return val;
};

/**
 * Adds methods to the Y.Node prototype, routing through scrubVal.
 * @method addMethod
 * @static
 *
 * @param {String} name The name of the method to add
 * @param {Function} fn The function that becomes the method
 * @param {Object} context An optional context to call the method with
 * (defaults to the Node instance)
 * @return {any} Depends on what is returned from the DOM node.
 */
Y_Node.addMethod = function(name, fn, context) {
    if (name && fn && typeof fn == 'function') {
        Y_Node.prototype[name] = function() {
            var args = _slice.call(arguments),
                node = this,
                ret;

            if (args[0] && args[0]._node) {
                args[0] = args[0]._node;
            }

            if (args[1] && args[1]._node) {
                args[1] = args[1]._node;
            }
            args.unshift(node._node);

            ret = fn.apply(context || node, args);

            if (ret) { // scrub truthy
                ret = Y_Node.scrubVal(ret, node);
            }

            (typeof ret != 'undefined') || (ret = node);
            return ret;
        };
    } else {
    }
};

/**
 * Imports utility methods to be added as Y.Node methods.
 * @method importMethod
 * @static
 *
 * @param {Object} host The object that contains the method to import.
 * @param {String} name The name of the method to import
 * @param {String} altName An optional name to use in place of the host name
 * @param {Object} context An optional context to call the method with
 */
Y_Node.importMethod = function(host, name, altName) {
    if (typeof name == 'string') {
        altName = altName || name;
        Y_Node.addMethod(altName, host[name], host);
    } else {
        Y.Array.each(name, function(n) {
            Y_Node.importMethod(host, n);
        });
    }
};

/**
 * Retrieves a NodeList based on the given CSS selector.
 * @method all
 *
 * @param {string} selector The CSS selector to test against.
 * @return {NodeList} A NodeList instance for the matching HTMLCollection/Array.
 * @for YUI
 */

/**
 * Returns a single Node instance bound to the node or the
 * first element matching the given selector. Returns null if no match found.
 * <strong>Note:</strong> For chaining purposes you may want to
 * use <code>Y.all</code>, which returns a NodeList when no match is found.
 * @method one
 * @param {String | HTMLElement} node a node or Selector
 * @return {Node | null} a Node instance or null if no match found.
 * @for YUI
 */

/**
 * Returns a single Node instance bound to the node or the
 * first element matching the given selector. Returns null if no match found.
 * <strong>Note:</strong> For chaining purposes you may want to
 * use <code>Y.all</code>, which returns a NodeList when no match is found.
 * @method one
 * @static
 * @param {String | HTMLElement} node a node or Selector
 * @return {Node | null} a Node instance or null if no match found.
 * @for Node
 */
Y_Node.one = function(node) {
    var instance = null,
        cachedNode,
        uid;

    if (node) {
        if (typeof node == 'string') {
            node = Y_Node._fromString(node);
            if (!node) {
                return null; // NOTE: return
            }
        } else if (node.getDOMNode) {
            return node; // NOTE: return
        }

        if (node.nodeType || Y.DOM.isWindow(node)) { // avoid bad input (numbers, boolean, etc)
            uid = (node.uniqueID && node.nodeType !== 9) ? node.uniqueID : node._yuid;
            instance = Y_Node._instances[uid]; // reuse exising instances
            cachedNode = instance ? instance._node : null;
            if (!instance || (cachedNode && node !== cachedNode)) { // new Node when nodes don't match
                instance = new Y_Node(node);
                if (node.nodeType != 11) { // dont cache document fragment
                    Y_Node._instances[instance[UID]] = instance; // cache node
                }
            }
        }
    }

    return instance;
};

/**
 * The default setter for DOM properties
 * Called with instance context (this === the Node instance)
 * @method DEFAULT_SETTER
 * @static
 * @param {String} name The attribute/property being set
 * @param {any} val The value to be set
 * @return {any} The value
 */
Y_Node.DEFAULT_SETTER = function(name, val) {
    var node = this._stateProxy,
        strPath;

    if (name.indexOf(DOT) > -1) {
        strPath = name;
        name = name.split(DOT);
        // only allow when defined on node
        Y.Object.setValue(node, name, val);
    } else if (typeof node[name] != 'undefined') { // pass thru DOM properties
        node[name] = val;
    }

    return val;
};

/**
 * The default getter for DOM properties
 * Called with instance context (this === the Node instance)
 * @method DEFAULT_GETTER
 * @static
 * @param {String} name The attribute/property to look up
 * @return {any} The current value
 */
Y_Node.DEFAULT_GETTER = function(name) {
    var node = this._stateProxy,
        val;

    if (name.indexOf && name.indexOf(DOT) > -1) {
        val = Y.Object.getValue(node, name.split(DOT));
    } else if (typeof node[name] != 'undefined') { // pass thru from DOM
        val = node[name];
    }

    return val;
};

Y.mix(Y_Node.prototype, {
    DATA_PREFIX: 'data-',

    /**
     * The method called when outputting Node instances as strings
     * @method toString
     * @return {String} A string representation of the Node instance
     */
    toString: function() {
        var str = this[UID] + ': not bound to a node',
            node = this._node,
            attrs, id, className;

        if (node) {
            attrs = node.attributes;
            id = (attrs && attrs.id) ? node.getAttribute('id') : null;
            className = (attrs && attrs.className) ? node.getAttribute('className') : null;
            str = node[NODE_NAME];

            if (id) {
                str += '#' + id;
            }

            if (className) {
                str += '.' + className.replace(' ', '.');
            }

            // TODO: add yuid?
            str += ' ' + this[UID];
        }
        return str;
    },

    /**
     * Returns an attribute value on the Node instance.
     * Unless pre-configured (via `Node.ATTRS`), get hands
     * off to the underlying DOM node.  Only valid
     * attributes/properties for the node will be queried.
     * @method get
     * @param {String} attr The attribute
     * @return {any} The current value of the attribute
     */
    get: function(attr) {
        var val;

        if (this._getAttr) { // use Attribute imple
            val = this._getAttr(attr);
        } else {
            val = this._get(attr);
        }

        if (val) {
            val = Y_Node.scrubVal(val, this);
        } else if (val === null) {
            val = null; // IE: DOM null is not true null (even though they ===)
        }
        return val;
    },

    /**
     * Helper method for get.
     * @method _get
     * @private
     * @param {String} attr The attribute
     * @return {any} The current value of the attribute
     */
    _get: function(attr) {
        var attrConfig = Y_Node.ATTRS[attr],
            val;

        if (attrConfig && attrConfig.getter) {
            val = attrConfig.getter.call(this);
        } else if (Y_Node.re_aria.test(attr)) {
            val = this._node.getAttribute(attr, 2);
        } else {
            val = Y_Node.DEFAULT_GETTER.apply(this, arguments);
        }

        return val;
    },

    /**
     * Sets an attribute on the Node instance.
     * Unless pre-configured (via Node.ATTRS), set hands
     * off to the underlying DOM node.  Only valid
     * attributes/properties for the node will be set.
     * To set custom attributes use setAttribute.
     * @method set
     * @param {String} attr The attribute to be set.
     * @param {any} val The value to set the attribute to.
     * @chainable
     */
    set: function(attr, val) {
        var attrConfig = Y_Node.ATTRS[attr];

        if (this._setAttr) { // use Attribute imple
            this._setAttr.apply(this, arguments);
        } else { // use setters inline
            if (attrConfig && attrConfig.setter) {
                attrConfig.setter.call(this, val, attr);
            } else if (Y_Node.re_aria.test(attr)) { // special case Aria
                this._node.setAttribute(attr, val);
            } else {
                Y_Node.DEFAULT_SETTER.apply(this, arguments);
            }
        }

        return this;
    },

    /**
     * Sets multiple attributes.
     * @method setAttrs
     * @param {Object} attrMap an object of name/value pairs to set
     * @chainable
     */
    setAttrs: function(attrMap) {
        if (this._setAttrs) { // use Attribute imple
            this._setAttrs(attrMap);
        } else { // use setters inline
            Y.Object.each(attrMap, function(v, n) {
                this.set(n, v);
            }, this);
        }

        return this;
    },

    /**
     * Returns an object containing the values for the requested attributes.
     * @method getAttrs
     * @param {Array} attrs an array of attributes to get values
     * @return {Object} An object with attribute name/value pairs.
     */
    getAttrs: function(attrs) {
        var ret = {};
        if (this._getAttrs) { // use Attribute imple
            this._getAttrs(attrs);
        } else { // use setters inline
            Y.Array.each(attrs, function(v, n) {
                ret[v] = this.get(v);
            }, this);
        }

        return ret;
    },

    /**
     * Compares nodes to determine if they match.
     * Node instances can be compared to each other and/or HTMLElements.
     * @method compareTo
     * @param {HTMLElement | Node} refNode The reference node to compare to the node.
     * @return {Boolean} True if the nodes match, false if they do not.
     */
    compareTo: function(refNode) {
        var node = this._node;

        if (refNode && refNode._node) {
            refNode = refNode._node;
        }
        return node === refNode;
    },

    /**
     * Determines whether the node is appended to the document.
     * @method inDoc
     * @param {Node|HTMLElement} doc optional An optional document to check against.
     * Defaults to current document.
     * @return {Boolean} Whether or not this node is appended to the document.
     */
    inDoc: function(doc) {
        var node = this._node;

        if (node) {
            doc = (doc) ? doc._node || doc : node[OWNER_DOCUMENT];
            if (doc.documentElement) {
                return Y_DOM.contains(doc.documentElement, node);
            }
        }

        return false;
    },

    getById: function(id) {
        var node = this._node,
            ret = Y_DOM.byId(id, node[OWNER_DOCUMENT]);
        if (ret && Y_DOM.contains(node, ret)) {
            ret = Y.one(ret);
        } else {
            ret = null;
        }
        return ret;
    },

   /**
     * Returns the nearest ancestor that passes the test applied by supplied boolean method.
     * @method ancestor
     * @param {String | Function} fn A selector string or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * If fn is not passed as an argument, the parent node will be returned.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan
     * @param {String | Function} stopFn optional A selector string or boolean
     * method to indicate when the search should stop. The search bails when the function
     * returns true or the selector matches.
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {Node} The matching Node instance or null if not found
     */
    ancestor: function(fn, testSelf, stopFn) {
        // testSelf is optional, check for stopFn as 2nd arg
        if (arguments.length === 2 &&
                (typeof testSelf == 'string' || typeof testSelf == 'function')) {
            stopFn = testSelf;
        }

        return Y.one(Y_DOM.ancestor(this._node, _wrapFn(fn), testSelf, _wrapFn(stopFn)));
    },

   /**
     * Returns the ancestors that pass the test applied by supplied boolean method.
     * @method ancestors
     * @param {String | Function} fn A selector string or boolean method for testing elements.
     * @param {Boolean} testSelf optional Whether or not to include the element in the scan
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {NodeList} A NodeList instance containing the matching elements
     */
    ancestors: function(fn, testSelf, stopFn) {
        if (arguments.length === 2 &&
                (typeof testSelf == 'string' || typeof testSelf == 'function')) {
            stopFn = testSelf;
        }
        return Y.all(Y_DOM.ancestors(this._node, _wrapFn(fn), testSelf, _wrapFn(stopFn)));
    },

    /**
     * Returns the previous matching sibling.
     * Returns the nearest element node sibling if no method provided.
     * @method previous
     * @param {String | Function} fn A selector or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * @param {Boolean} [all] Whether text nodes as well as element nodes should be returned, or
     * just element nodes will be returned(default)
     * @return {Node} Node instance or null if not found
     */
    previous: function(fn, all) {
        return Y.one(Y_DOM.elementByAxis(this._node, 'previousSibling', _wrapFn(fn), all));
    },

    /**
     * Returns the next matching sibling.
     * Returns the nearest element node sibling if no method provided.
     * @method next
     * @param {String | Function} fn A selector or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * @param {Boolean} [all] Whether text nodes as well as element nodes should be returned, or
     * just element nodes will be returned(default)
     * @return {Node} Node instance or null if not found
     */
    next: function(fn, all) {
        return Y.one(Y_DOM.elementByAxis(this._node, 'nextSibling', _wrapFn(fn), all));
    },

    /**
     * Returns all matching siblings.
     * Returns all siblings if no method provided.
     * @method siblings
     * @param {String | Function} fn A selector or boolean method for testing elements.
     * If a function is used, it receives the current node being tested as the only argument.
     * @return {NodeList} NodeList instance bound to found siblings
     */
    siblings: function(fn) {
        return Y.all(Y_DOM.siblings(this._node, _wrapFn(fn)));
    },

    /**
     * Retrieves a single Node instance, the first element matching the given
     * CSS selector.
     * Returns null if no match found.
     * @method one
     *
     * @param {string} selector The CSS selector to test against.
     * @return {Node | null} A Node instance for the matching HTMLElement or null
     * if no match found.
     */
    one: function(selector) {
        return Y.one(Y.Selector.query(selector, this._node, true));
    },

    /**
     * Retrieves a NodeList based on the given CSS selector.
     * @method all
     *
     * @param {string} selector The CSS selector to test against.
     * @return {NodeList} A NodeList instance for the matching HTMLCollection/Array.
     */
    all: function(selector) {
        var nodelist;

        if (this._node) {
            nodelist = Y.all(Y.Selector.query(selector, this._node));
            nodelist._query = selector;
            nodelist._queryRoot = this._node;
        }

        return nodelist || Y.all([]);
    },

    // TODO: allow fn test
    /**
     * Test if the supplied node matches the supplied selector.
     * @method test
     *
     * @param {string} selector The CSS selector to test against.
     * @return {boolean} Whether or not the node matches the selector.
     */
    test: function(selector) {
        return Y.Selector.test(this._node, selector);
    },

    /**
     * Removes the node from its parent.
     * Shortcut for myNode.get('parentNode').removeChild(myNode);
     * @method remove
     * @param {Boolean} destroy whether or not to call destroy() on the node
     * after removal.
     * @chainable
     *
     */
    remove: function(destroy) {
        var node = this._node;

        if (node && node.parentNode) {
            node.parentNode.removeChild(node);
        }

        if (destroy) {
            this.destroy();
        }

        return this;
    },

    /**
     * Replace the node with the other node. This is a DOM update only
     * and does not change the node bound to the Node instance.
     * Shortcut for myNode.get('parentNode').replaceChild(newNode, myNode);
     * @method replace
     * @param {Node | HTMLElement} newNode Node to be inserted
     * @chainable
     *
     */
    replace: function(newNode) {
        var node = this._node;
        if (typeof newNode == 'string') {
            newNode = Y_Node.create(newNode);
        }
        node.parentNode.replaceChild(Y_Node.getDOMNode(newNode), node);
        return this;
    },

    /**
     * @method replaceChild
     * @for Node
     * @param {String | HTMLElement | Node} node Node to be inserted
     * @param {HTMLElement | Node} refNode Node to be replaced
     * @return {Node} The replaced node
     */
    replaceChild: function(node, refNode) {
        if (typeof node == 'string') {
            node = Y_DOM.create(node);
        }

        return Y.one(this._node.replaceChild(Y_Node.getDOMNode(node), Y_Node.getDOMNode(refNode)));
    },

    /**
     * Nulls internal node references, removes any plugins and event listeners.
     * Note that destroy() will not remove the node from its parent or from the DOM. For that
     * functionality, call remove(true).
     * @method destroy
     * @param {Boolean} recursivePurge (optional) Whether or not to remove listeners from the
     * node's subtree (default is false)
     *
     */
    destroy: function(recursive) {
        var UID = Y.config.doc.uniqueID ? 'uniqueID' : '_yuid',
            instance;

        this.purge(); // TODO: only remove events add via this Node

        if (this.unplug) { // may not be a PluginHost
            this.unplug();
        }

        this.clearData();

        if (recursive) {
            Y.NodeList.each(this.all('*'), function(node) {
                instance = Y_Node._instances[node[UID]];
                if (instance) {
                   instance.destroy();
                } else { // purge in case added by other means
                    Y.Event.purgeElement(node);
                }
            });
        }

        this._node = null;
        this._stateProxy = null;

        delete Y_Node._instances[this._yuid];
    },

    /**
     * Invokes a method on the Node instance
     * @method invoke
     * @param {String} method The name of the method to invoke
     * @param {any} [args*] Arguments to invoke the method with.
     * @return {any} Whatever the underly method returns.
     * DOM Nodes and Collections return values
     * are converted to Node/NodeList instances.
     *
     */
    invoke: function(method, a, b, c, d, e) {
        var node = this._node,
            ret;

        if (a && a._node) {
            a = a._node;
        }

        if (b && b._node) {
            b = b._node;
        }

        ret = node[method](a, b, c, d, e);
        return Y_Node.scrubVal(ret, this);
    },

    /**
    * @method swap
    * @description Swap DOM locations with the given node.
    * This does not change which DOM node each Node instance refers to.
    * @param {Node} otherNode The node to swap with
     * @chainable
    */
    swap: Y.config.doc.documentElement.swapNode ?
        function(otherNode) {
            this._node.swapNode(Y_Node.getDOMNode(otherNode));
        } :
        function(otherNode) {
            otherNode = Y_Node.getDOMNode(otherNode);
            var node = this._node,
                parent = otherNode.parentNode,
                nextSibling = otherNode.nextSibling;

            if (nextSibling === node) {
                parent.insertBefore(node, otherNode);
            } else if (otherNode === node.nextSibling) {
                parent.insertBefore(otherNode, node);
            } else {
                node.parentNode.replaceChild(otherNode, node);
                Y_DOM.addHTML(parent, node, nextSibling);
            }
            return this;
        },


    hasMethod: function(method) {
        var node = this._node;
        return !!(node && method in node &&
                typeof node[method] != 'unknown' &&
            (typeof node[method] == 'function' ||
                String(node[method]).indexOf('function') === 1)); // IE reports as object, prepends space
    },

    isFragment: function() {
        return (this.get('nodeType') === 11);
    },

    /**
     * Removes and destroys all of the nodes within the node.
     * @method empty
     * @chainable
     */
    empty: function() {
        this.get('childNodes').remove().destroy(true);
        return this;
    },

    /**
     * Returns the DOM node bound to the Node instance
     * @method getDOMNode
     * @return {HTMLElement}
     */
    getDOMNode: function() {
        return this._node;
    }
}, true);

Y.Node = Y_Node;
Y.one = Y_Node.one;
/**
 * The NodeList module provides support for managing collections of Nodes.
 * @module node
 * @submodule node-core
 */

/**
 * The NodeList class provides a wrapper for manipulating DOM NodeLists.
 * NodeList properties can be accessed via the set/get methods.
 * Use Y.all() to retrieve NodeList instances.
 *
 * @class NodeList
 * @constructor
 * @param nodes {String|element|Node|Array} A selector, DOM element, Node, list of DOM elements, or list of Nodes with which to populate this NodeList.
 */

var NodeList = function(nodes) {
    var tmp = [];

    if (nodes) {
        if (typeof nodes === 'string') { // selector query
            this._query = nodes;
            nodes = Y.Selector.query(nodes);
        } else if (nodes.nodeType || Y_DOM.isWindow(nodes)) { // domNode || window
            nodes = [nodes];
        } else if (nodes._node) { // Y.Node
            nodes = [nodes._node];
        } else if (nodes[0] && nodes[0]._node) { // allow array of Y.Nodes
            Y.Array.each(nodes, function(node) {
                if (node._node) {
                    tmp.push(node._node);
                }
            });
            nodes = tmp;
        } else { // array of domNodes or domNodeList (no mixed array of Y.Node/domNodes)
            nodes = Y.Array(nodes, 0, true);
        }
    }

    /**
     * The underlying array of DOM nodes bound to the Y.NodeList instance
     * @property _nodes
     * @private
     */
    this._nodes = nodes || [];
};

NodeList.NAME = 'NodeList';

/**
 * Retrieves the DOM nodes bound to a NodeList instance
 * @method getDOMNodes
 * @static
 *
 * @param {NodeList} nodelist The NodeList instance
 * @return {Array} The array of DOM nodes bound to the NodeList
 */
NodeList.getDOMNodes = function(nodelist) {
    return (nodelist && nodelist._nodes) ? nodelist._nodes : nodelist;
};

NodeList.each = function(instance, fn, context) {
    var nodes = instance._nodes;
    if (nodes && nodes.length) {
        Y.Array.each(nodes, fn, context || instance);
    } else {
    }
};

NodeList.addMethod = function(name, fn, context) {
    if (name && fn) {
        NodeList.prototype[name] = function() {
            var ret = [],
                args = arguments;

            Y.Array.each(this._nodes, function(node) {
                var UID = (node.uniqueID && node.nodeType !== 9 ) ? 'uniqueID' : '_yuid',
                    instance = Y.Node._instances[node[UID]],
                    ctx,
                    result;

                if (!instance) {
                    instance = NodeList._getTempNode(node);
                }
                ctx = context || instance;
                result = fn.apply(ctx, args);
                if (result !== undefined && result !== instance) {
                    ret[ret.length] = result;
                }
            });

            // TODO: remove tmp pointer
            return ret.length ? ret : this;
        };
    } else {
    }
};

NodeList.importMethod = function(host, name, altName) {
    if (typeof name === 'string') {
        altName = altName || name;
        NodeList.addMethod(name, host[name]);
    } else {
        Y.Array.each(name, function(n) {
            NodeList.importMethod(host, n);
        });
    }
};

NodeList._getTempNode = function(node) {
    var tmp = NodeList._tempNode;
    if (!tmp) {
        tmp = Y.Node.create('<div></div>');
        NodeList._tempNode = tmp;
    }

    tmp._node = node;
    tmp._stateProxy = node;
    return tmp;
};

Y.mix(NodeList.prototype, {
    _invoke: function(method, args, getter) {
        var ret = (getter) ? [] : this;

        this.each(function(node) {
            var val = node[method].apply(node, args);
            if (getter) {
                ret.push(val);
            }
        });

        return ret;
    },

    /**
     * Retrieves the Node instance at the given index.
     * @method item
     *
     * @param {Number} index The index of the target Node.
     * @return {Node} The Node instance at the given index.
     */
    item: function(index) {
        return Y.one((this._nodes || [])[index]);
    },

    /**
     * Applies the given function to each Node in the NodeList.
     * @method each
     * @param {Function} fn The function to apply. It receives 3 arguments:
     * the current node instance, the node's index, and the NodeList instance
     * @param {Object} context optional An optional context to apply the function with
     * Default context is the current Node instance
     * @chainable
     */
    each: function(fn, context) {
        var instance = this;
        Y.Array.each(this._nodes, function(node, index) {
            node = Y.one(node);
            return fn.call(context || node, node, index, instance);
        });
        return instance;
    },

    batch: function(fn, context) {
        var nodelist = this;

        Y.Array.each(this._nodes, function(node, index) {
            var instance = Y.Node._instances[node[UID]];
            if (!instance) {
                instance = NodeList._getTempNode(node);
            }

            return fn.call(context || instance, instance, index, nodelist);
        });
        return nodelist;
    },

    /**
     * Executes the function once for each node until a true value is returned.
     * @method some
     * @param {Function} fn The function to apply. It receives 3 arguments:
     * the current node instance, the node's index, and the NodeList instance
     * @param {Object} context optional An optional context to execute the function from.
     * Default context is the current Node instance
     * @return {Boolean} Whether or not the function returned true for any node.
     */
    some: function(fn, context) {
        var instance = this;
        return Y.Array.some(this._nodes, function(node, index) {
            node = Y.one(node);
            context = context || node;
            return fn.call(context, node, index, instance);
        });
    },

    /**
     * Creates a documenFragment from the nodes bound to the NodeList instance
     * @method toFrag
     * @return {Node} a Node instance bound to the documentFragment
     */
    toFrag: function() {
        return Y.one(Y.DOM._nl2frag(this._nodes));
    },

    /**
     * Returns the index of the node in the NodeList instance
     * or -1 if the node isn't found.
     * @method indexOf
     * @param {Node | HTMLElement} node the node to search for
     * @return {Number} the index of the node value or -1 if not found
     */
    indexOf: function(node) {
        return Y.Array.indexOf(this._nodes, Y.Node.getDOMNode(node));
    },

    /**
     * Filters the NodeList instance down to only nodes matching the given selector.
     * @method filter
     * @param {String} selector The selector to filter against
     * @return {NodeList} NodeList containing the updated collection
     * @see Selector
     */
    filter: function(selector) {
        return Y.all(Y.Selector.filter(this._nodes, selector));
    },


    /**
     * Creates a new NodeList containing all nodes at every n indices, where
     * remainder n % index equals r.
     * (zero-based index).
     * @method modulus
     * @param {Number} n The offset to use (return every nth node)
     * @param {Number} r An optional remainder to use with the modulus operation (defaults to zero)
     * @return {NodeList} NodeList containing the updated collection
     */
    modulus: function(n, r) {
        r = r || 0;
        var nodes = [];
        NodeList.each(this, function(node, i) {
            if (i % n === r) {
                nodes.push(node);
            }
        });

        return Y.all(nodes);
    },

    /**
     * Creates a new NodeList containing all nodes at odd indices
     * (zero-based index).
     * @method odd
     * @return {NodeList} NodeList containing the updated collection
     */
    odd: function() {
        return this.modulus(2, 1);
    },

    /**
     * Creates a new NodeList containing all nodes at even indices
     * (zero-based index), including zero.
     * @method even
     * @return {NodeList} NodeList containing the updated collection
     */
    even: function() {
        return this.modulus(2);
    },

    destructor: function() {
    },

    /**
     * Reruns the initial query, when created using a selector query
     * @method refresh
     * @chainable
     */
    refresh: function() {
        var doc,
            nodes = this._nodes,
            query = this._query,
            root = this._queryRoot;

        if (query) {
            if (!root) {
                if (nodes && nodes[0] && nodes[0].ownerDocument) {
                    root = nodes[0].ownerDocument;
                }
            }

            this._nodes = Y.Selector.query(query, root);
        }

        return this;
    },

    /**
     * Returns the current number of items in the NodeList.
     * @method size
     * @return {Number} The number of items in the NodeList.
     */
    size: function() {
        return this._nodes.length;
    },

    /**
     * Determines if the instance is bound to any nodes
     * @method isEmpty
     * @return {Boolean} Whether or not the NodeList is bound to any nodes
     */
    isEmpty: function() {
        return this._nodes.length < 1;
    },

    toString: function() {
        var str = '',
            errorMsg = this[UID] + ': not bound to any nodes',
            nodes = this._nodes,
            node;

        if (nodes && nodes[0]) {
            node = nodes[0];
            str += node[NODE_NAME];
            if (node.id) {
                str += '#' + node.id;
            }

            if (node.className) {
                str += '.' + node.className.replace(' ', '.');
            }

            if (nodes.length > 1) {
                str += '...[' + nodes.length + ' items]';
            }
        }
        return str || errorMsg;
    },

    /**
     * Returns the DOM node bound to the Node instance
     * @method getDOMNodes
     * @return {Array}
     */
    getDOMNodes: function() {
        return this._nodes;
    }
}, true);

NodeList.importMethod(Y.Node.prototype, [
     /**
      * Called on each Node instance. Nulls internal node references,
      * removes any plugins and event listeners
      * @method destroy
      * @param {Boolean} recursivePurge (optional) Whether or not to
      * remove listeners from the node's subtree (default is false)
      * @see Node.destroy
      */
    'destroy',

     /**
      * Called on each Node instance. Removes and destroys all of the nodes
      * within the node
      * @method empty
      * @chainable
      * @see Node.empty
      */
    'empty',

     /**
      * Called on each Node instance. Removes the node from its parent.
      * Shortcut for myNode.get('parentNode').removeChild(myNode);
      * @method remove
      * @param {Boolean} destroy whether or not to call destroy() on the node
      * after removal.
      * @chainable
      * @see Node.remove
      */
    'remove',

     /**
      * Called on each Node instance. Sets an attribute on the Node instance.
      * Unless pre-configured (via Node.ATTRS), set hands
      * off to the underlying DOM node.  Only valid
      * attributes/properties for the node will be set.
      * To set custom attributes use setAttribute.
      * @method set
      * @param {String} attr The attribute to be set.
      * @param {any} val The value to set the attribute to.
      * @chainable
      * @see Node.set
      */
    'set'
]);

// one-off implementation to convert array of Nodes to NodeList
// e.g. Y.all('input').get('parentNode');

/** Called on each Node instance
  * @method get
  * @see Node
  */
NodeList.prototype.get = function(attr) {
    var ret = [],
        nodes = this._nodes,
        isNodeList = false,
        getTemp = NodeList._getTempNode,
        instance,
        val;

    if (nodes[0]) {
        instance = Y.Node._instances[nodes[0]._yuid] || getTemp(nodes[0]);
        val = instance._get(attr);
        if (val && val.nodeType) {
            isNodeList = true;
        }
    }

    Y.Array.each(nodes, function(node) {
        instance = Y.Node._instances[node._yuid];

        if (!instance) {
            instance = getTemp(node);
        }

        val = instance._get(attr);
        if (!isNodeList) { // convert array of Nodes to NodeList
            val = Y.Node.scrubVal(val, instance);
        }

        ret.push(val);
    });

    return (isNodeList) ? Y.all(ret) : ret;
};

Y.NodeList = NodeList;

Y.all = function(nodes) {
    return new NodeList(nodes);
};

Y.Node.all = Y.all;
/**
 * @module node
 * @submodule node-core
 */

var Y_NodeList = Y.NodeList,
    ArrayProto = Array.prototype,
    ArrayMethods = {
        /** Returns a new NodeList combining the given NodeList(s)
          * @for NodeList
          * @method concat
          * @param {NodeList | Array} valueN Arrays/NodeLists and/or values to
          * concatenate to the resulting NodeList
          * @return {NodeList} A new NodeList comprised of this NodeList joined with the input.
          */
        'concat': 1,
        /** Removes the last from the NodeList and returns it.
          * @for NodeList
          * @method pop
          * @return {Node | null} The last item in the NodeList, or null if the list is empty.
          */
        'pop': 0,
        /** Adds the given Node(s) to the end of the NodeList.
          * @for NodeList
          * @method push
          * @param {Node | HTMLElement} nodes One or more nodes to add to the end of the NodeList.
          */
        'push': 0,
        /** Removes the first item from the NodeList and returns it.
          * @for NodeList
          * @method shift
          * @return {Node | null} The first item in the NodeList, or null if the NodeList is empty.
          */
        'shift': 0,
        /** Returns a new NodeList comprising the Nodes in the given range.
          * @for NodeList
          * @method slice
          * @param {Number} begin Zero-based index at which to begin extraction.
          As a negative index, start indicates an offset from the end of the sequence. slice(-2) extracts the second-to-last element and the last element in the sequence.
          * @param {Number} end Zero-based index at which to end extraction. slice extracts up to but not including end.
          slice(1,4) extracts the second element through the fourth element (elements indexed 1, 2, and 3).
          As a negative index, end indicates an offset from the end of the sequence. slice(2,-1) extracts the third element through the second-to-last element in the sequence.
          If end is omitted, slice extracts to the end of the sequence.
          * @return {NodeList} A new NodeList comprised of this NodeList joined with the input.
          */
        'slice': 1,
        /** Changes the content of the NodeList, adding new elements while removing old elements.
          * @for NodeList
          * @method splice
          * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end.
          * @param {Number} howMany An integer indicating the number of old array elements to remove. If howMany is 0, no elements are removed. In this case, you should specify at least one new element. If no howMany parameter is specified (second syntax above, which is a SpiderMonkey extension), all elements after index are removed.
          * {Node | HTMLElement| element1, ..., elementN
          The elements to add to the array. If you don't specify any elements, splice simply removes elements from the array.
          * @return {NodeList} The element(s) removed.
          */
        'splice': 1,
        /** Adds the given Node(s) to the beginning of the NodeList.
          * @for NodeList
          * @method unshift
          * @param {Node | HTMLElement} nodes One or more nodes to add to the NodeList.
          */
        'unshift': 0
    };


Y.Object.each(ArrayMethods, function(returnNodeList, name) {
    Y_NodeList.prototype[name] = function() {
        var args = [],
            i = 0,
            arg,
            ret;

        while (typeof (arg = arguments[i++]) != 'undefined') { // use DOM nodes/nodeLists
            args.push(arg._node || arg._nodes || arg);
        }

        ret = ArrayProto[name].apply(this._nodes, args);

        if (returnNodeList) {
            ret = Y.all(ret);
        } else {
            ret = Y.Node.scrubVal(ret);
        }

        return ret;
    };
});
/**
 * @module node
 * @submodule node-core
 */

Y.Array.each([
    /**
     * Passes through to DOM method.
     * @for Node
     * @method removeChild
     * @param {HTMLElement | Node} node Node to be removed
     * @return {Node} The removed node
     */
    'removeChild',

    /**
     * Passes through to DOM method.
     * @method hasChildNodes
     * @return {Boolean} Whether or not the node has any childNodes
     */
    'hasChildNodes',

    /**
     * Passes through to DOM method.
     * @method cloneNode
     * @param {Boolean} deep Whether or not to perform a deep clone, which includes
     * subtree and attributes
     * @return {Node} The clone
     */
    'cloneNode',

    /**
     * Passes through to DOM method.
     * @method hasAttribute
     * @param {String} attribute The attribute to test for
     * @return {Boolean} Whether or not the attribute is present
     */
    'hasAttribute',

    /**
     * Passes through to DOM method.
     * @method scrollIntoView
     * @chainable
     */
    'scrollIntoView',

    /**
     * Passes through to DOM method.
     * @method getElementsByTagName
     * @param {String} tagName The tagName to collect
     * @return {NodeList} A NodeList representing the HTMLCollection
     */
    'getElementsByTagName',

    /**
     * Passes through to DOM method.
     * @method focus
     * @chainable
     */
    'focus',

    /**
     * Passes through to DOM method.
     * @method blur
     * @chainable
     */
    'blur',

    /**
     * Passes through to DOM method.
     * Only valid on FORM elements
     * @method submit
     * @chainable
     */
    'submit',

    /**
     * Passes through to DOM method.
     * Only valid on FORM elements
     * @method reset
     * @chainable
     */
    'reset',

    /**
     * Passes through to DOM method.
     * @method select
     * @chainable
     */
     'select',

    /**
     * Passes through to DOM method.
     * Only valid on TABLE elements
     * @method createCaption
     * @chainable
     */
    'createCaption'

], function(method) {
    Y.Node.prototype[method] = function(arg1, arg2, arg3) {
        var ret = this.invoke(method, arg1, arg2, arg3);
        return ret;
    };
});

/**
 * Passes through to DOM method.
 * @method removeAttribute
 * @param {String} attribute The attribute to be removed
 * @chainable
 */
 // one-off implementation due to IE returning boolean, breaking chaining
Y.Node.prototype.removeAttribute = function(attr) {
    var node = this._node;
    if (node) {
        node.removeAttribute(attr, 0); // comma zero for IE < 8 to force case-insensitive
    }

    return this;
};

Y.Node.importMethod(Y.DOM, [
    /**
     * Determines whether the node is an ancestor of another HTML element in the DOM hierarchy.
     * @method contains
     * @param {Node | HTMLElement} needle The possible node or descendent
     * @return {Boolean} Whether or not this node is the needle its ancestor
     */
    'contains',
    /**
     * Allows setting attributes on DOM nodes, normalizing in some cases.
     * This passes through to the DOM node, allowing for custom attributes.
     * @method setAttribute
     * @for Node
     * @chainable
     * @param {string} name The attribute name
     * @param {string} value The value to set
     */
    'setAttribute',
    /**
     * Allows getting attributes on DOM nodes, normalizing in some cases.
     * This passes through to the DOM node, allowing for custom attributes.
     * @method getAttribute
     * @for Node
     * @param {string} name The attribute name
     * @return {string} The attribute value
     */
    'getAttribute',

    /**
     * Wraps the given HTML around the node.
     * @method wrap
     * @param {String} html The markup to wrap around the node.
     * @chainable
     * @for Node
     */
    'wrap',

    /**
     * Removes the node's parent node.
     * @method unwrap
     * @chainable
     */
    'unwrap',

    /**
     * Applies a unique ID to the node if none exists
     * @method generateID
     * @return {String} The existing or generated ID
     */
    'generateID'
]);

Y.NodeList.importMethod(Y.Node.prototype, [
/**
 * Allows getting attributes on DOM nodes, normalizing in some cases.
 * This passes through to the DOM node, allowing for custom attributes.
 * @method getAttribute
 * @see Node
 * @for NodeList
 * @param {string} name The attribute name
 * @return {string} The attribute value
 */

    'getAttribute',
/**
 * Allows setting attributes on DOM nodes, normalizing in some cases.
 * This passes through to the DOM node, allowing for custom attributes.
 * @method setAttribute
 * @see Node
 * @for NodeList
 * @chainable
 * @param {string} name The attribute name
 * @param {string} value The value to set
 */
    'setAttribute',

/**
 * Allows for removing attributes on DOM nodes.
 * This passes through to the DOM node, allowing for custom attributes.
 * @method removeAttribute
 * @see Node
 * @for NodeList
 * @param {string} name The attribute to remove
 */
    'removeAttribute',
/**
 * Removes the parent node from node in the list.
 * @method unwrap
 * @chainable
 */
    'unwrap',
/**
 * Wraps the given HTML around each node.
 * @method wrap
 * @param {String} html The markup to wrap around the node.
 * @chainable
 */
    'wrap',

/**
 * Applies a unique ID to each node if none exists
 * @method generateID
 * @return {String} The existing or generated ID
 */
    'generateID'
]);


}, '3.17.1', {"requires": ["dom-core", "selector"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('dom-style', function (Y, NAME) {

/**
 * Add style management functionality to DOM.
 * @module dom
 * @submodule dom-style
 * @for DOM
 */

var DOCUMENT_ELEMENT = 'documentElement',
    DEFAULT_VIEW = 'defaultView',
    OWNER_DOCUMENT = 'ownerDocument',
    STYLE = 'style',
    FLOAT = 'float',
    CSS_FLOAT = 'cssFloat',
    STYLE_FLOAT = 'styleFloat',
    TRANSPARENT = 'transparent',
    GET_COMPUTED_STYLE = 'getComputedStyle',
    GET_BOUNDING_CLIENT_RECT = 'getBoundingClientRect',

    DOCUMENT = Y.config.doc,

    Y_DOM = Y.DOM,

    TRANSFORM,
    TRANSFORMORIGIN,
    VENDOR_TRANSFORM = [
        'WebkitTransform',
        'MozTransform',
        'OTransform',
        'msTransform',
        'transform'
    ],

    re_unit = /width|height|top|left|right|bottom|margin|padding/i;

Y.Array.each(VENDOR_TRANSFORM, function(val) {
    if (val in DOCUMENT[DOCUMENT_ELEMENT].style) {
        TRANSFORM = val;
        TRANSFORMORIGIN = val + "Origin";
    }
});

Y.mix(Y_DOM, {
    DEFAULT_UNIT: 'px',

    CUSTOM_STYLES: {
    },


    /**
     * Sets a style property for a given element.
     * @method setStyle
     * @param {HTMLElement} node The HTMLElement to apply the style to.
     * @param {String} att The style property to set.
     * @param {String|Number} val The value.
     * @param {Object} [style] The style node. Defaults to `node.style`.
     */
    setStyle: function(node, att, val, style) {
        style = style || node.style;
        var CUSTOM_STYLES = Y_DOM.CUSTOM_STYLES;

        if (style) {
            if (val === null || val === '') { // normalize unsetting
                val = '';
            } else if (!isNaN(Number(val)) && re_unit.test(att)) { // number values may need a unit
                val += Y_DOM.DEFAULT_UNIT;
            }

            if (att in CUSTOM_STYLES) {
                if (CUSTOM_STYLES[att].set) {
                    CUSTOM_STYLES[att].set(node, val, style);
                    return; // NOTE: return
                } else if (typeof CUSTOM_STYLES[att] === 'string') {
                    att = CUSTOM_STYLES[att];
                }
            } else if (att === '') { // unset inline styles
                att = 'cssText';
                val = '';
            }
            style[att] = val;
        }
    },

    /**
     * Returns the current style value for the given property.
     * @method getStyle
     * @param {HTMLElement} node The HTMLElement to get the style from.
     * @param {String} att The style property to get.
     * @param {Object} [style] The style node. Defaults to `node.style`.
     */
    getStyle: function(node, att, style) {
        style = style || node.style;
        var CUSTOM_STYLES = Y_DOM.CUSTOM_STYLES,
            val = '';

        if (style) {
            if (att in CUSTOM_STYLES) {
                if (CUSTOM_STYLES[att].get) {
                    return CUSTOM_STYLES[att].get(node, att, style); // NOTE: return
                } else if (typeof CUSTOM_STYLES[att] === 'string') {
                    att = CUSTOM_STYLES[att];
                }
            }
            val = style[att];
            if (val === '') { // TODO: is empty string sufficient?
                val = Y_DOM[GET_COMPUTED_STYLE](node, att);
            }
        }

        return val;
    },

    /**
     * Sets multiple style properties.
     * @method setStyles
     * @param {HTMLElement} node The HTMLElement to apply the styles to.
     * @param {Object} hash An object literal of property:value pairs.
     */
    setStyles: function(node, hash) {
        var style = node.style;
        Y.each(hash, function(v, n) {
            Y_DOM.setStyle(node, n, v, style);
        }, Y_DOM);
    },

    /**
     * Returns the computed style for the given node.
     * @method getComputedStyle
     * @param {HTMLElement} node The HTMLElement to get the style from.
     * @param {String} att The style property to get.
     * @return {String} The computed value of the style property.
     */
    getComputedStyle: function(node, att) {
        var val = '',
            doc = node[OWNER_DOCUMENT],
            computed;

        if (node[STYLE] && doc[DEFAULT_VIEW] && doc[DEFAULT_VIEW][GET_COMPUTED_STYLE]) {
            computed = doc[DEFAULT_VIEW][GET_COMPUTED_STYLE](node, null);
            if (computed) { // FF may be null in some cases (ticket #2530548)
                val = computed[att];
            }
        }
        return val;
    }
});

// normalize reserved word float alternatives ("cssFloat" or "styleFloat")
if (DOCUMENT[DOCUMENT_ELEMENT][STYLE][CSS_FLOAT] !== undefined) {
    Y_DOM.CUSTOM_STYLES[FLOAT] = CSS_FLOAT;
} else if (DOCUMENT[DOCUMENT_ELEMENT][STYLE][STYLE_FLOAT] !== undefined) {
    Y_DOM.CUSTOM_STYLES[FLOAT] = STYLE_FLOAT;
}

// safari converts transparent to rgba(), others use "transparent"
if (Y.UA.webkit) {
    Y_DOM[GET_COMPUTED_STYLE] = function(node, att) {
        var view = node[OWNER_DOCUMENT][DEFAULT_VIEW],
            val = view[GET_COMPUTED_STYLE](node, '')[att];

        if (val === 'rgba(0, 0, 0, 0)') {
            val = TRANSPARENT;
        }

        return val;
    };

}

Y.DOM._getAttrOffset = function(node, attr) {
    var val = Y.DOM[GET_COMPUTED_STYLE](node, attr),
        offsetParent = node.offsetParent,
        position,
        parentOffset,
        offset;

    if (val === 'auto') {
        position = Y.DOM.getStyle(node, 'position');
        if (position === 'static' || position === 'relative') {
            val = 0;
        } else if (offsetParent && offsetParent[GET_BOUNDING_CLIENT_RECT]) {
            parentOffset = offsetParent[GET_BOUNDING_CLIENT_RECT]()[attr];
            offset = node[GET_BOUNDING_CLIENT_RECT]()[attr];
            if (attr === 'left' || attr === 'top') {
                val = offset - parentOffset;
            } else {
                val = parentOffset - node[GET_BOUNDING_CLIENT_RECT]()[attr];
            }
        }
    }

    return val;
};

Y.DOM._getOffset = function(node) {
    var pos,
        xy = null;

    if (node) {
        pos = Y_DOM.getStyle(node, 'position');
        xy = [
            parseInt(Y_DOM[GET_COMPUTED_STYLE](node, 'left'), 10),
            parseInt(Y_DOM[GET_COMPUTED_STYLE](node, 'top'), 10)
        ];

        if ( isNaN(xy[0]) ) { // in case of 'auto'
            xy[0] = parseInt(Y_DOM.getStyle(node, 'left'), 10); // try inline
            if ( isNaN(xy[0]) ) { // default to offset value
                xy[0] = (pos === 'relative') ? 0 : node.offsetLeft || 0;
            }
        }

        if ( isNaN(xy[1]) ) { // in case of 'auto'
            xy[1] = parseInt(Y_DOM.getStyle(node, 'top'), 10); // try inline
            if ( isNaN(xy[1]) ) { // default to offset value
                xy[1] = (pos === 'relative') ? 0 : node.offsetTop || 0;
            }
        }
    }

    return xy;

};

if (TRANSFORM) {
    Y_DOM.CUSTOM_STYLES.transform = {
        set: function(node, val, style) {
            style[TRANSFORM] = val;
        },

        get: function(node) {
            return Y_DOM[GET_COMPUTED_STYLE](node, TRANSFORM);
        }
    };

    Y_DOM.CUSTOM_STYLES.transformOrigin = {
        set: function(node, val, style) {
            style[TRANSFORMORIGIN] = val;
        },

        get: function(node) {
            return Y_DOM[GET_COMPUTED_STYLE](node, TRANSFORMORIGIN);
        }
    };
}


}, '3.17.1', {"requires": ["dom-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-delegate', function (Y, NAME) {

/**
 * Adds event delegation support to the library.
 *
 * @module event
 * @submodule event-delegate
 */

var toArray          = Y.Array,
    YLang            = Y.Lang,
    isString         = YLang.isString,
    isObject         = YLang.isObject,
    isArray          = YLang.isArray,
    selectorTest     = Y.Selector.test,
    detachCategories = Y.Env.evt.handles;

/**
 * <p>Sets up event delegation on a container element.  The delegated event
 * will use a supplied selector or filtering function to test if the event
 * references at least one node that should trigger the subscription
 * callback.</p>
 *
 * <p>Selector string filters will trigger the callback if the event originated
 * from a node that matches it or is contained in a node that matches it.
 * Function filters are called for each Node up the parent axis to the
 * subscribing container node, and receive at each level the Node and the event
 * object.  The function should return true (or a truthy value) if that Node
 * should trigger the subscription callback.  Note, it is possible for filters
 * to match multiple Nodes for a single event.  In this case, the delegate
 * callback will be executed for each matching Node.</p>
 *
 * <p>For each matching Node, the callback will be executed with its 'this'
 * object set to the Node matched by the filter (unless a specific context was
 * provided during subscription), and the provided event's
 * <code>currentTarget</code> will also be set to the matching Node.  The
 * containing Node from which the subscription was originally made can be
 * referenced as <code>e.container</code>.
 *
 * @method delegate
 * @param type {String} the event type to delegate
 * @param fn {Function} the callback function to execute.  This function
 *              will be provided the event object for the delegated event.
 * @param el {String|node} the element that is the delegation container
 * @param filter {string|Function} a selector that must match the target of the
 *              event or a function to test target and its parents for a match
 * @param context optional argument that specifies what 'this' refers to.
 * @param args* 0..n additional arguments to pass on to the callback function.
 *              These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @static
 * @for Event
 */
function delegate(type, fn, el, filter) {
    var args     = toArray(arguments, 0, true),
        query    = isString(el) ? el : null,
        typeBits, synth, container, categories, cat, i, len, handles, handle;

    // Support Y.delegate({ click: fnA, key: fnB }, el, filter, ...);
    // and Y.delegate(['click', 'key'], fn, el, filter, ...);
    if (isObject(type)) {
        handles = [];

        if (isArray(type)) {
            for (i = 0, len = type.length; i < len; ++i) {
                args[0] = type[i];
                handles.push(Y.delegate.apply(Y, args));
            }
        } else {
            // Y.delegate({'click', fn}, el, filter) =>
            // Y.delegate('click', fn, el, filter)
            args.unshift(null); // one arg becomes two; need to make space

            for (i in type) {
                if (type.hasOwnProperty(i)) {
                    args[0] = i;
                    args[1] = type[i];
                    handles.push(Y.delegate.apply(Y, args));
                }
            }
        }

        return new Y.EventHandle(handles);
    }

    typeBits = type.split(/\|/);

    if (typeBits.length > 1) {
        cat  = typeBits.shift();
        args[0] = type = typeBits.shift();
    }

    synth = Y.Node.DOM_EVENTS[type];

    if (isObject(synth) && synth.delegate) {
        handle = synth.delegate.apply(synth, arguments);
    }

    if (!handle) {
        if (!type || !fn || !el || !filter) {
            return;
        }

        container = (query) ? Y.Selector.query(query, null, true) : el;

        if (!container && isString(el)) {
            handle = Y.on('available', function () {
                Y.mix(handle, Y.delegate.apply(Y, args), true);
            }, el);
        }

        if (!handle && container) {
            args.splice(2, 2, container); // remove the filter

            handle = Y.Event._attach(args, { facade: false });
            handle.sub.filter  = filter;
            handle.sub._notify = delegate.notifySub;
        }
    }

    if (handle && cat) {
        categories = detachCategories[cat]  || (detachCategories[cat] = {});
        categories = categories[type] || (categories[type] = []);
        categories.push(handle);
    }

    return handle;
}

/**
Overrides the <code>_notify</code> method on the normal DOM subscription to
inject the filtering logic and only proceed in the case of a match.

This method is hosted as a private property of the `delegate` method
(e.g. `Y.delegate.notifySub`)

@method notifySub
@param thisObj {Object} default 'this' object for the callback
@param args {Array} arguments passed to the event's <code>fire()</code>
@param ce {CustomEvent} the custom event managing the DOM subscriptions for
             the subscribed event on the subscribing node.
@return {Boolean} false if the event was stopped
@private
@static
@since 3.2.0
**/
delegate.notifySub = function (thisObj, args, ce) {
    // Preserve args for other subscribers
    args = args.slice();
    if (this.args) {
        args.push.apply(args, this.args);
    }

    // Only notify subs if the event occurred on a targeted element
    var currentTarget = delegate._applyFilter(this.filter, args, ce),
        //container     = e.currentTarget,
        e, i, len, ret;

    if (currentTarget) {
        // Support multiple matches up the the container subtree
        currentTarget = toArray(currentTarget);

        // The second arg is the currentTarget, but we'll be reusing this
        // facade, replacing the currentTarget for each use, so it doesn't
        // matter what element we seed it with.
        e = args[0] = new Y.DOMEventFacade(args[0], ce.el, ce);

        e.container = Y.one(ce.el);

        for (i = 0, len = currentTarget.length; i < len && !e.stopped; ++i) {
            e.currentTarget = Y.one(currentTarget[i]);

            ret = this.fn.apply(this.context || e.currentTarget, args);

            if (ret === false) { // stop further notifications
                break;
            }
        }

        return ret;
    }
};

/**
Compiles a selector string into a filter function to identify whether
Nodes along the parent axis of an event's target should trigger event
notification.

This function is memoized, so previously compiled filter functions are
returned if the same selector string is provided.

This function may be useful when defining synthetic events for delegate
handling.

Hosted as a property of the `delegate` method (e.g. `Y.delegate.compileFilter`).

@method compileFilter
@param selector {String} the selector string to base the filtration on
@return {Function}
@since 3.2.0
@static
**/
delegate.compileFilter = Y.cached(function (selector) {
    return function (target, e) {
        return selectorTest(target._node, selector,
            (e.currentTarget === e.target) ? null : e.currentTarget._node);
    };
});

/**
Regex to test for disabled elements during filtering. This is only relevant to
IE to normalize behavior with other browsers, which swallow events that occur
to disabled elements. IE fires the event from the parent element instead of the
original target, though it does preserve `event.srcElement` as the disabled
element. IE also supports disabled on `<a>`, but the event still bubbles, so it
acts more like `e.preventDefault()` plus styling. That issue is not handled here
because other browsers fire the event on the `<a>`, so delegate is supported in
both cases.

@property _disabledRE
@type {RegExp}
@protected
@since 3.8.1
**/
delegate._disabledRE = /^(?:button|input|select|textarea)$/i;

/**
Walks up the parent axis of an event's target, and tests each element
against a supplied filter function.  If any Nodes, including the container,
satisfy the filter, the delegated callback will be triggered for each.

Hosted as a protected property of the `delegate` method (e.g.
`Y.delegate._applyFilter`).

@method _applyFilter
@param filter {Function} boolean function to test for inclusion in event
                 notification
@param args {Array} the arguments that would be passed to subscribers
@param ce   {CustomEvent} the DOM event wrapper
@return {Node|Node[]|undefined} The Node or Nodes that satisfy the filter
@protected
**/
delegate._applyFilter = function (filter, args, ce) {
    var e         = args[0],
        container = ce.el, // facadeless events in IE, have no e.currentTarget
        target    = e.target || e.srcElement,
        match     = [],
        isContainer = false;

    // Resolve text nodes to their containing element
    if (target.nodeType === 3) {
        target = target.parentNode;
    }

    // For IE. IE propagates events from the parent element of disabled
    // elements, where other browsers swallow the event entirely. To normalize
    // this in IE, filtering for matching elements should abort if the target
    // is a disabled form control.
    if (target.disabled && delegate._disabledRE.test(target.nodeName)) {
        return match;
    }

    // passing target as the first arg rather than leaving well enough alone
    // making 'this' in the filter function refer to the target.  This is to
    // support bound filter functions.
    args.unshift(target);

    if (isString(filter)) {
        while (target) {
            isContainer = (target === container);
            if (selectorTest(target, filter, (isContainer ? null: container))) {
                match.push(target);
            }

            if (isContainer) {
                break;
            }

            target = target.parentNode;
        }
    } else {
        // filter functions are implementer code and should receive wrappers
        args[0] = Y.one(target);
        args[1] = new Y.DOMEventFacade(e, container, ce);

        while (target) {
            // filter(target, e, extra args...) - this === target
            if (filter.apply(args[0], args)) {
                match.push(target);
            }

            if (target === container) {
                break;
            }

            target = target.parentNode;
            args[0] = Y.one(target);
        }
        args[1] = e; // restore the raw DOM event
    }

    if (match.length <= 1) {
        match = match[0]; // single match or undefined
    }

    // remove the target
    args.shift();

    return match;
};

/**
 * Sets up event delegation on a container element.  The delegated event
 * will use a supplied filter to test if the callback should be executed.
 * This filter can be either a selector string or a function that returns
 * a Node to use as the currentTarget for the event.
 *
 * The event object for the delegated event is supplied to the callback
 * function.  It is modified slightly in order to support all properties
 * that may be needed for event delegation.  'currentTarget' is set to
 * the element that matched the selector string filter or the Node returned
 * from the filter function.  'container' is set to the element that the
 * listener is delegated from (this normally would be the 'currentTarget').
 *
 * Filter functions will be called with the arguments that would be passed to
 * the callback function, including the event object as the first parameter.
 * The function should return false (or a falsey value) if the success criteria
 * aren't met, and the Node to use as the event's currentTarget and 'this'
 * object if they are.
 *
 * @method delegate
 * @param type {string} the event type to delegate
 * @param fn {function} the callback function to execute.  This function
 * will be provided the event object for the delegated event.
 * @param el {string|node} the element that is the delegation container
 * @param filter {string|function} a selector that must match the target of the
 * event or a function that returns a Node or false.
 * @param context optional argument that specifies what 'this' refers to.
 * @param args* 0..n additional arguments to pass on to the callback function.
 * These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @for YUI
 */
Y.delegate = Y.Event.delegate = delegate;


}, '3.17.1', {"requires": ["node-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-event-delegate', function (Y, NAME) {

/**
 * Functionality to make the node a delegated event container
 * @module node
 * @submodule node-event-delegate
 */

/**
 * <p>Sets up a delegation listener for an event occurring inside the Node.
 * The delegated event will be verified against a supplied selector or
 * filtering function to test if the event references at least one node that
 * should trigger the subscription callback.</p>
 *
 * <p>Selector string filters will trigger the callback if the event originated
 * from a node that matches it or is contained in a node that matches it.
 * Function filters are called for each Node up the parent axis to the
 * subscribing container node, and receive at each level the Node and the event
 * object.  The function should return true (or a truthy value) if that Node
 * should trigger the subscription callback.  Note, it is possible for filters
 * to match multiple Nodes for a single event.  In this case, the delegate
 * callback will be executed for each matching Node.</p>
 *
 * <p>For each matching Node, the callback will be executed with its 'this'
 * object set to the Node matched by the filter (unless a specific context was
 * provided during subscription), and the provided event's
 * <code>currentTarget</code> will also be set to the matching Node.  The
 * containing Node from which the subscription was originally made can be
 * referenced as <code>e.container</code>.
 *
 * @method delegate
 * @param type {String} the event type to delegate
 * @param fn {Function} the callback function to execute.  This function
 *              will be provided the event object for the delegated event.
 * @param spec {String|Function} a selector that must match the target of the
 *              event or a function to test target and its parents for a match
 * @param context {Object} optional argument that specifies what 'this' refers to.
 * @param args* {any} 0..n additional arguments to pass on to the callback function.
 *              These arguments will be added after the event object.
 * @return {EventHandle} the detach handle
 * @for Node
 */
Y.Node.prototype.delegate = function(type) {

    var args = Y.Array(arguments, 0, true),
        index = (Y.Lang.isObject(type) && !Y.Lang.isArray(type)) ? 1 : 2;

    args.splice(index, 0, this._node);

    return Y.delegate.apply(Y, args);
};


}, '3.17.1', {"requires": ["node-base", "event-delegate"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('pluginhost-base', function (Y, NAME) {

    /**
     * Provides the augmentable PluginHost interface, which can be added to any class.
     * @module pluginhost
     */

    /**
     * Provides the augmentable PluginHost interface, which can be added to any class.
     * @module pluginhost-base
     */

    /**
     * <p>
     * An augmentable class, which provides the augmented class with the ability to host plugins.
     * It adds <a href="#method_plug">plug</a> and <a href="#method_unplug">unplug</a> methods to the augmented class, which can
     * be used to add or remove plugins from instances of the class.
     * </p>
     *
     * <p>Plugins can also be added through the constructor configuration object passed to the host class' constructor using
     * the "plugins" property. Supported values for the "plugins" property are those defined by the <a href="#method_plug">plug</a> method.
     *
     * For example the following code would add the AnimPlugin and IOPlugin to Overlay (the plugin host):
     * <xmp>
     * var o = new Overlay({plugins: [ AnimPlugin, {fn:IOPlugin, cfg:{section:"header"}}]});
     * </xmp>
     * </p>
     * <p>
     * Plug.Host's protected <a href="#method_initPlugins">_initPlugins</a> and <a href="#method_destroyPlugins">_destroyPlugins</a>
     * methods should be invoked by the host class at the appropriate point in the host's lifecyle.
     * </p>
     *
     * @class Plugin.Host
     */

    var L = Y.Lang;

    function PluginHost() {
        this._plugins = {};
    }

    PluginHost.prototype = {

        /**
         * Adds a plugin to the host object. This will instantiate the
         * plugin and attach it to the configured namespace on the host object.
         *
         * @method plug
         * @chainable
         * @param P {Function | Object |Array} Accepts the plugin class, or an
         * object with a "fn" property specifying the plugin class and
         * a "cfg" property specifying the configuration for the Plugin.
         * <p>
         * Additionally an Array can also be passed in, with the above function or
         * object values, allowing the user to add multiple plugins in a single call.
         * </p>
         * @param config (Optional) If the first argument is the plugin class, the second argument
         * can be the configuration for the plugin.
         * @return {Base} A reference to the host object
         */
        plug: function(Plugin, config) {
            var i, ln, ns;

            if (L.isArray(Plugin)) {
                for (i = 0, ln = Plugin.length; i < ln; i++) {
                    this.plug(Plugin[i]);
                }
            } else {
                if (Plugin && !L.isFunction(Plugin)) {
                    config = Plugin.cfg;
                    Plugin = Plugin.fn;
                }

                // Plugin should be fn by now
                if (Plugin && Plugin.NS) {
                    ns = Plugin.NS;

                    config = config || {};
                    config.host = this;

                    if (this.hasPlugin(ns)) {
                        // Update config
                        if (this[ns].setAttrs) {
                            this[ns].setAttrs(config);
                        }
                    } else {
                        // Create new instance
                        this[ns] = new Plugin(config);
                        this._plugins[ns] = Plugin;
                    }
                }
            }
            return this;
        },

        /**
         * Removes a plugin from the host object. This will destroy the
         * plugin instance and delete the namespace from the host object.
         *
         * @method unplug
         * @param {String | Function} plugin The namespace of the plugin, or the plugin class with the static NS namespace property defined. If not provided,
         * all registered plugins are unplugged.
         * @return {Base} A reference to the host object
         * @chainable
         */
        unplug: function(plugin) {
            var ns = plugin,
                plugins = this._plugins;

            if (plugin) {
                if (L.isFunction(plugin)) {
                    ns = plugin.NS;
                    if (ns && (!plugins[ns] || plugins[ns] !== plugin)) {
                        ns = null;
                    }
                }

                if (ns) {
                    if (this[ns]) {
                        if (this[ns].destroy) {
                            this[ns].destroy();
                        }
                        delete this[ns];
                    }
                    if (plugins[ns]) {
                        delete plugins[ns];
                    }
                }
            } else {
                for (ns in this._plugins) {
                    if (this._plugins.hasOwnProperty(ns)) {
                        this.unplug(ns);
                    }
                }
            }
            return this;
        },

        /**
         * Determines if a plugin has plugged into this host.
         *
         * @method hasPlugin
         * @param {String} ns The plugin's namespace
         * @return {Plugin} Returns a truthy value (the plugin instance) if present, or undefined if not.
         */
        hasPlugin : function(ns) {
            return (this._plugins[ns] && this[ns]);
        },

        /**
         * Initializes static plugins registered on the host (using the
         * Base.plug static method) and any plugins passed to the
         * instance through the "plugins" configuration property.
         *
         * @method _initPlugins
         * @param {Object} config The configuration object with property name/value pairs.
         * @private
         */

        _initPlugins: function(config) {
            this._plugins = this._plugins || {};

            if (this._initConfigPlugins) {
                this._initConfigPlugins(config);
            }
        },

        /**
         * Unplugs and destroys all plugins on the host
         * @method _destroyPlugins
         * @private
         */
        _destroyPlugins: function() {
            this.unplug();
        }
    };

    Y.namespace("Plugin").Host = PluginHost;


}, '3.17.1', {"requires": ["yui-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('pluginhost-config', function (Y, NAME) {

    /**
     * Adds pluginhost constructor configuration and static configuration support
     * @submodule pluginhost-config
     */

    var PluginHost = Y.Plugin.Host,
        L = Y.Lang;

    /**
     * A protected initialization method, used by the host class to initialize
     * plugin configurations passed the constructor, through the config object.
     *
     * Host objects should invoke this method at the appropriate time in their
     * construction lifecycle.
     *
     * @method _initConfigPlugins
     * @param {Object} config The configuration object passed to the constructor
     * @protected
     * @for Plugin.Host
     */
    PluginHost.prototype._initConfigPlugins = function(config) {

        // Class Configuration
        var classes = (this._getClasses) ? this._getClasses() : [this.constructor],
            plug = [],
            unplug = {},
            constructor, i, classPlug, classUnplug, pluginClassName;

        // TODO: Room for optimization. Can we apply statically/unplug in same pass?
        for (i = classes.length - 1; i >= 0; i--) {
            constructor = classes[i];

            classUnplug = constructor._UNPLUG;
            if (classUnplug) {
                // subclasses over-write
                Y.mix(unplug, classUnplug, true);
            }

            classPlug = constructor._PLUG;
            if (classPlug) {
                // subclasses over-write
                Y.mix(plug, classPlug, true);
            }
        }

        for (pluginClassName in plug) {
            if (plug.hasOwnProperty(pluginClassName)) {
                if (!unplug[pluginClassName]) {
                    this.plug(plug[pluginClassName]);
                }
            }
        }

        // User Configuration
        if (config && config.plugins) {
            this.plug(config.plugins);
        }
    };

    /**
     * Registers plugins to be instantiated at the class level (plugins
     * which should be plugged into every instance of the class by default).
     *
     * @method plug
     * @static
     *
     * @param {Function} hostClass The host class on which to register the plugins
     * @param {Function | Array} plugin Either the plugin class, an array of plugin classes or an array of objects (with fn and cfg properties defined)
     * @param {Object} config (Optional) If plugin is the plugin class, the configuration for the plugin
     * @for Plugin.Host
     */
    PluginHost.plug = function(hostClass, plugin, config) {
        // Cannot plug into Base, since Plugins derive from Base [ will cause infinite recurrsion ]
        var p, i, l, name;

        if (hostClass !== Y.Base) {
            hostClass._PLUG = hostClass._PLUG || {};

            if (!L.isArray(plugin)) {
                if (config) {
                    plugin = {fn:plugin, cfg:config};
                }
                plugin = [plugin];
            }

            for (i = 0, l = plugin.length; i < l;i++) {
                p = plugin[i];
                name = p.NAME || p.fn.NAME;
                hostClass._PLUG[name] = p;
            }
        }
    };

    /**
     * Unregisters any class level plugins which have been registered by the host class, or any
     * other class in the hierarchy.
     *
     * @method unplug
     * @static
     *
     * @param {Function} hostClass The host class from which to unregister the plugins
     * @param {Function | Array} plugin The plugin class, or an array of plugin classes
     * @for Plugin.Host
     */
    PluginHost.unplug = function(hostClass, plugin) {
        var p, i, l, name;

        if (hostClass !== Y.Base) {
            hostClass._UNPLUG = hostClass._UNPLUG || {};

            if (!L.isArray(plugin)) {
                plugin = [plugin];
            }

            for (i = 0, l = plugin.length; i < l; i++) {
                p = plugin[i];
                name = p.NAME;
                if (!hostClass._PLUG[name]) {
                    hostClass._UNPLUG[name] = p;
                } else {
                    delete hostClass._PLUG[name];
                }
            }
        }
    };


}, '3.17.1', {"requires": ["pluginhost-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-pluginhost', function (Y, NAME) {

/**
 * @module node
 * @submodule node-pluginhost
 */

/**
 * Registers plugins to be instantiated at the class level (plugins
 * which should be plugged into every instance of Node by default).
 *
 * @method plug
 * @static
 * @for Node
 * @param {Function | Array} plugin Either the plugin class, an array of plugin classes or an array of objects (with fn and cfg properties defined)
 * @param {Object} config (Optional) If plugin is the plugin class, the configuration for the plugin
 */
Y.Node.plug = function() {
    var args = Y.Array(arguments);
    args.unshift(Y.Node);
    Y.Plugin.Host.plug.apply(Y.Base, args);
    return Y.Node;
};

/**
 * Unregisters any class level plugins which have been registered by the Node
 *
 * @method unplug
 * @static
 *
 * @param {Function | Array} plugin The plugin class, or an array of plugin classes
 */
Y.Node.unplug = function() {
    var args = Y.Array(arguments);
    args.unshift(Y.Node);
    Y.Plugin.Host.unplug.apply(Y.Base, args);
    return Y.Node;
};

Y.mix(Y.Node, Y.Plugin.Host, false, null, 1);

// run PluginHost constructor on cached Node instances
Y.Object.each(Y.Node._instances, function (node) {
    Y.Plugin.Host.apply(node);
});

// allow batching of plug/unplug via NodeList
// doesn't use NodeList.importMethod because we need real Nodes (not tmpNode)
/**
 * Adds a plugin to each node in the NodeList.
 * This will instantiate the plugin and attach it to the configured namespace on each node
 * @method plug
 * @for NodeList
 * @param P {Function | Object |Array} Accepts the plugin class, or an
 * object with a "fn" property specifying the plugin class and
 * a "cfg" property specifying the configuration for the Plugin.
 * <p>
 * Additionally an Array can also be passed in, with the above function or
 * object values, allowing the user to add multiple plugins in a single call.
 * </p>
 * @param config (Optional) If the first argument is the plugin class, the second argument
 * can be the configuration for the plugin.
 * @chainable
 */
Y.NodeList.prototype.plug = function() {
    var args = arguments;
    Y.NodeList.each(this, function(node) {
        Y.Node.prototype.plug.apply(Y.one(node), args);
    });
    return this;
};

/**
 * Removes a plugin from all nodes in the NodeList. This will destroy the
 * plugin instance and delete the namespace each node.
 * @method unplug
 * @for NodeList
 * @param {String | Function} plugin The namespace of the plugin, or the plugin class with the static NS namespace property defined. If not provided,
 * all registered plugins are unplugged.
 * @chainable
 */
Y.NodeList.prototype.unplug = function() {
    var args = arguments;
    Y.NodeList.each(this, function(node) {
        Y.Node.prototype.unplug.apply(Y.one(node), args);
    });
    return this;
};


}, '3.17.1', {"requires": ["node-base", "pluginhost"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('dom-screen', function (Y, NAME) {

(function(Y) {

/**
 * Adds position and region management functionality to DOM.
 * @module dom
 * @submodule dom-screen
 * @for DOM
 */

var DOCUMENT_ELEMENT = 'documentElement',
    COMPAT_MODE = 'compatMode',
    POSITION = 'position',
    FIXED = 'fixed',
    RELATIVE = 'relative',
    LEFT = 'left',
    TOP = 'top',
    _BACK_COMPAT = 'BackCompat',
    MEDIUM = 'medium',
    BORDER_LEFT_WIDTH = 'borderLeftWidth',
    BORDER_TOP_WIDTH = 'borderTopWidth',
    GET_BOUNDING_CLIENT_RECT = 'getBoundingClientRect',
    GET_COMPUTED_STYLE = 'getComputedStyle',

    Y_DOM = Y.DOM,

    // TODO: how about thead/tbody/tfoot/tr?
    // TODO: does caption matter?
    RE_TABLE = /^t(?:able|d|h)$/i,

    SCROLL_NODE;

if (Y.UA.ie) {
    if (Y.config.doc[COMPAT_MODE] !== 'BackCompat') {
        SCROLL_NODE = DOCUMENT_ELEMENT;
    } else {
        SCROLL_NODE = 'body';
    }
}

Y.mix(Y_DOM, {
    /**
     * Returns the inner height of the viewport (exludes scrollbar).
     * @method winHeight
     * @return {Number} The current height of the viewport.
     */
    winHeight: function(node) {
        var h = Y_DOM._getWinSize(node).height;
        return h;
    },

    /**
     * Returns the inner width of the viewport (exludes scrollbar).
     * @method winWidth
     * @return {Number} The current width of the viewport.
     */
    winWidth: function(node) {
        var w = Y_DOM._getWinSize(node).width;
        return w;
    },

    /**
     * Document height
     * @method docHeight
     * @return {Number} The current height of the document.
     */
    docHeight:  function(node) {
        var h = Y_DOM._getDocSize(node).height;
        return Math.max(h, Y_DOM._getWinSize(node).height);
    },

    /**
     * Document width
     * @method docWidth
     * @return {Number} The current width of the document.
     */
    docWidth:  function(node) {
        var w = Y_DOM._getDocSize(node).width;
        return Math.max(w, Y_DOM._getWinSize(node).width);
    },

    /**
     * Amount page has been scroll horizontally
     * @method docScrollX
     * @return {Number} The current amount the screen is scrolled horizontally.
     */
    docScrollX: function(node, doc) {
        doc = doc || (node) ? Y_DOM._getDoc(node) : Y.config.doc; // perf optimization
        var dv = doc.defaultView,
            pageOffset = (dv) ? dv.pageXOffset : 0;
        return Math.max(doc[DOCUMENT_ELEMENT].scrollLeft, doc.body.scrollLeft, pageOffset);
    },

    /**
     * Amount page has been scroll vertically
     * @method docScrollY
     * @return {Number} The current amount the screen is scrolled vertically.
     */
    docScrollY:  function(node, doc) {
        doc = doc || (node) ? Y_DOM._getDoc(node) : Y.config.doc; // perf optimization
        var dv = doc.defaultView,
            pageOffset = (dv) ? dv.pageYOffset : 0;
        return Math.max(doc[DOCUMENT_ELEMENT].scrollTop, doc.body.scrollTop, pageOffset);
    },

    /**
     * Gets the current position of an element based on page coordinates.
     * Element must be part of the DOM tree to have page coordinates
     * (display:none or elements not appended return false).
     * @method getXY
     * @param element The target element
     * @return {Array} The XY position of the element

     TODO: test inDocument/display?
     */
    getXY: function() {
        if (Y.config.doc[DOCUMENT_ELEMENT][GET_BOUNDING_CLIENT_RECT]) {
            return function(node) {
                var xy = null,
                    scrollLeft,
                    scrollTop,
                    mode,
                    box,
                    offX,
                    offY,
                    doc,
                    win,
                    inDoc,
                    rootNode;

                if (node && node.tagName) {
                    doc = node.ownerDocument;
                    mode = doc[COMPAT_MODE];

                    if (mode !== _BACK_COMPAT) {
                        rootNode = doc[DOCUMENT_ELEMENT];
                    } else {
                        rootNode = doc.body;
                    }

                    // inline inDoc check for perf
                    if (rootNode.contains) {
                        inDoc = rootNode.contains(node);
                    } else {
                        inDoc = Y.DOM.contains(rootNode, node);
                    }

                    if (inDoc) {
                        win = doc.defaultView;

                        // inline scroll calc for perf
                        if (win && 'pageXOffset' in win) {
                            scrollLeft = win.pageXOffset;
                            scrollTop = win.pageYOffset;
                        } else {
                            scrollLeft = (SCROLL_NODE) ? doc[SCROLL_NODE].scrollLeft : Y_DOM.docScrollX(node, doc);
                            scrollTop = (SCROLL_NODE) ? doc[SCROLL_NODE].scrollTop : Y_DOM.docScrollY(node, doc);
                        }

                        if (Y.UA.ie) { // IE < 8, quirks, or compatMode
                            if (!doc.documentMode || doc.documentMode < 8 || mode === _BACK_COMPAT) {
                                offX = rootNode.clientLeft;
                                offY = rootNode.clientTop;
                            }
                        }
                        box = node[GET_BOUNDING_CLIENT_RECT]();
                        xy = [box.left, box.top];

                        if (offX || offY) {
                                xy[0] -= offX;
                                xy[1] -= offY;

                        }
                        if ((scrollTop || scrollLeft)) {
                            if (!Y.UA.ios || (Y.UA.ios >= 4.2)) {
                                xy[0] += scrollLeft;
                                xy[1] += scrollTop;
                            }

                        }
                    } else {
                        xy = Y_DOM._getOffset(node);
                    }
                }
                return xy;
            };
        } else {
            return function(node) { // manually calculate by crawling up offsetParents
                //Calculate the Top and Left border sizes (assumes pixels)
                var xy = null,
                    doc,
                    parentNode,
                    bCheck,
                    scrollTop,
                    scrollLeft;

                if (node) {
                    if (Y_DOM.inDoc(node)) {
                        xy = [node.offsetLeft, node.offsetTop];
                        doc = node.ownerDocument;
                        parentNode = node;
                        // TODO: refactor with !! or just falsey
                        bCheck = ((Y.UA.gecko || Y.UA.webkit > 519) ? true : false);

                        // TODO: worth refactoring for TOP/LEFT only?
                        while ((parentNode = parentNode.offsetParent)) {
                            xy[0] += parentNode.offsetLeft;
                            xy[1] += parentNode.offsetTop;
                            if (bCheck) {
                                xy = Y_DOM._calcBorders(parentNode, xy);
                            }
                        }

                        // account for any scrolled ancestors
                        if (Y_DOM.getStyle(node, POSITION) != FIXED) {
                            parentNode = node;

                            while ((parentNode = parentNode.parentNode)) {
                                scrollTop = parentNode.scrollTop;
                                scrollLeft = parentNode.scrollLeft;

                                //Firefox does something funky with borders when overflow is not visible.
                                if (Y.UA.gecko && (Y_DOM.getStyle(parentNode, 'overflow') !== 'visible')) {
                                        xy = Y_DOM._calcBorders(parentNode, xy);
                                }


                                if (scrollTop || scrollLeft) {
                                    xy[0] -= scrollLeft;
                                    xy[1] -= scrollTop;
                                }
                            }
                            xy[0] += Y_DOM.docScrollX(node, doc);
                            xy[1] += Y_DOM.docScrollY(node, doc);

                        } else {
                            //Fix FIXED position -- add scrollbars
                            xy[0] += Y_DOM.docScrollX(node, doc);
                            xy[1] += Y_DOM.docScrollY(node, doc);
                        }
                    } else {
                        xy = Y_DOM._getOffset(node);
                    }
                }

                return xy;
            };
        }
    }(),// NOTE: Executing for loadtime branching

    /**
    Gets the width of vertical scrollbars on overflowed containers in the body
    content.

    @method getScrollbarWidth
    @return {Number} Pixel width of a scrollbar in the current browser
    **/
    getScrollbarWidth: Y.cached(function () {
        var doc      = Y.config.doc,
            testNode = doc.createElement('div'),
            body     = doc.getElementsByTagName('body')[0],
            // 0.1 because cached doesn't support falsy refetch values
            width    = 0.1;

        if (body) {
            testNode.style.cssText = "position:absolute;visibility:hidden;overflow:scroll;width:20px;";
            testNode.appendChild(doc.createElement('p')).style.height = '1px';
            body.insertBefore(testNode, body.firstChild);
            width = testNode.offsetWidth - testNode.clientWidth;

            body.removeChild(testNode);
        }

        return width;
    }, null, 0.1),

    /**
     * Gets the current X position of an element based on page coordinates.
     * Element must be part of the DOM tree to have page coordinates
     * (display:none or elements not appended return false).
     * @method getX
     * @param element The target element
     * @return {Number} The X position of the element
     */

    getX: function(node) {
        return Y_DOM.getXY(node)[0];
    },

    /**
     * Gets the current Y position of an element based on page coordinates.
     * Element must be part of the DOM tree to have page coordinates
     * (display:none or elements not appended return false).
     * @method getY
     * @param element The target element
     * @return {Number} The Y position of the element
     */

    getY: function(node) {
        return Y_DOM.getXY(node)[1];
    },

    /**
     * Set the position of an html element in page coordinates.
     * The element must be part of the DOM tree to have page coordinates (display:none or elements not appended return false).
     * @method setXY
     * @param element The target element
     * @param {Array} xy Contains X & Y values for new position (coordinates are page-based)
     * @param {Boolean} noRetry By default we try and set the position a second time if the first fails
     */
    setXY: function(node, xy, noRetry) {
        var setStyle = Y_DOM.setStyle,
            pos,
            delta,
            newXY,
            currentXY;

        if (node && xy) {
            pos = Y_DOM.getStyle(node, POSITION);

            delta = Y_DOM._getOffset(node);
            if (pos == 'static') { // default to relative
                pos = RELATIVE;
                setStyle(node, POSITION, pos);
            }
            currentXY = Y_DOM.getXY(node);

            if (xy[0] !== null) {
                setStyle(node, LEFT, xy[0] - currentXY[0] + delta[0] + 'px');
            }

            if (xy[1] !== null) {
                setStyle(node, TOP, xy[1] - currentXY[1] + delta[1] + 'px');
            }

            if (!noRetry) {
                newXY = Y_DOM.getXY(node);
                if (newXY[0] !== xy[0] || newXY[1] !== xy[1]) {
                    Y_DOM.setXY(node, xy, true);
                }
            }

        } else {
        }
    },

    /**
     * Set the X position of an html element in page coordinates, regardless of how the element is positioned.
     * The element(s) must be part of the DOM tree to have page coordinates (display:none or elements not appended return false).
     * @method setX
     * @param element The target element
     * @param {Number} x The X values for new position (coordinates are page-based)
     */
    setX: function(node, x) {
        return Y_DOM.setXY(node, [x, null]);
    },

    /**
     * Set the Y position of an html element in page coordinates, regardless of how the element is positioned.
     * The element(s) must be part of the DOM tree to have page coordinates (display:none or elements not appended return false).
     * @method setY
     * @param element The target element
     * @param {Number} y The Y values for new position (coordinates are page-based)
     */
    setY: function(node, y) {
        return Y_DOM.setXY(node, [null, y]);
    },

    /**
     * @method swapXY
     * @description Swap the xy position with another node
     * @param {Node} node The node to swap with
     * @param {Node} otherNode The other node to swap with
     * @return {Node}
     */
    swapXY: function(node, otherNode) {
        var xy = Y_DOM.getXY(node);
        Y_DOM.setXY(node, Y_DOM.getXY(otherNode));
        Y_DOM.setXY(otherNode, xy);
    },

    _calcBorders: function(node, xy2) {
        var t = parseInt(Y_DOM[GET_COMPUTED_STYLE](node, BORDER_TOP_WIDTH), 10) || 0,
            l = parseInt(Y_DOM[GET_COMPUTED_STYLE](node, BORDER_LEFT_WIDTH), 10) || 0;
        if (Y.UA.gecko) {
            if (RE_TABLE.test(node.tagName)) {
                t = 0;
                l = 0;
            }
        }
        xy2[0] += l;
        xy2[1] += t;
        return xy2;
    },

    _getWinSize: function(node, doc) {
        doc  = doc || (node) ? Y_DOM._getDoc(node) : Y.config.doc;
        var win = doc.defaultView || doc.parentWindow,
            mode = doc[COMPAT_MODE],
            h = win.innerHeight,
            w = win.innerWidth,
            root = doc[DOCUMENT_ELEMENT];

        if ( mode && !Y.UA.opera ) { // IE, Gecko
            if (mode != 'CSS1Compat') { // Quirks
                root = doc.body;
            }
            h = root.clientHeight;
            w = root.clientWidth;
        }
        return { height: h, width: w };
    },

    _getDocSize: function(node) {
        var doc = (node) ? Y_DOM._getDoc(node) : Y.config.doc,
            root = doc[DOCUMENT_ELEMENT];

        if (doc[COMPAT_MODE] != 'CSS1Compat') {
            root = doc.body;
        }

        return { height: root.scrollHeight, width: root.scrollWidth };
    }
});

})(Y);
(function(Y) {
var TOP = 'top',
    RIGHT = 'right',
    BOTTOM = 'bottom',
    LEFT = 'left',

    getOffsets = function(r1, r2) {
        var t = Math.max(r1[TOP], r2[TOP]),
            r = Math.min(r1[RIGHT], r2[RIGHT]),
            b = Math.min(r1[BOTTOM], r2[BOTTOM]),
            l = Math.max(r1[LEFT], r2[LEFT]),
            ret = {};

        ret[TOP] = t;
        ret[RIGHT] = r;
        ret[BOTTOM] = b;
        ret[LEFT] = l;
        return ret;
    },

    DOM = Y.DOM;

Y.mix(DOM, {
    /**
     * Returns an Object literal containing the following about this element: (top, right, bottom, left)
     * @for DOM
     * @method region
     * @param {HTMLElement} element The DOM element.
     * @return {Object} Object literal containing the following about this element: (top, right, bottom, left)
     */
    region: function(node) {
        var xy = DOM.getXY(node),
            ret = false;

        if (node && xy) {
            ret = DOM._getRegion(
                xy[1], // top
                xy[0] + node.offsetWidth, // right
                xy[1] + node.offsetHeight, // bottom
                xy[0] // left
            );
        }

        return ret;
    },

    /**
     * Find the intersect information for the passed nodes.
     * @method intersect
     * @for DOM
     * @param {HTMLElement} element The first element
     * @param {HTMLElement | Object} element2 The element or region to check the interect with
     * @param {Object} altRegion An object literal containing the region for the first element if we already have the data (for performance e.g. DragDrop)
     * @return {Object} Object literal containing the following intersection data: (top, right, bottom, left, area, yoff, xoff, inRegion)
     */
    intersect: function(node, node2, altRegion) {
        var r = altRegion || DOM.region(node), region = {},
            n = node2,
            off;

        if (n.tagName) {
            region = DOM.region(n);
        } else if (Y.Lang.isObject(node2)) {
            region = node2;
        } else {
            return false;
        }

        off = getOffsets(region, r);
        return {
            top: off[TOP],
            right: off[RIGHT],
            bottom: off[BOTTOM],
            left: off[LEFT],
            area: ((off[BOTTOM] - off[TOP]) * (off[RIGHT] - off[LEFT])),
            yoff: ((off[BOTTOM] - off[TOP])),
            xoff: (off[RIGHT] - off[LEFT]),
            inRegion: DOM.inRegion(node, node2, false, altRegion)
        };

    },
    /**
     * Check if any part of this node is in the passed region
     * @method inRegion
     * @for DOM
     * @param {Object} node The node to get the region from
     * @param {Object} node2 The second node to get the region from or an Object literal of the region
     * @param {Boolean} all Should all of the node be inside the region
     * @param {Object} altRegion An object literal containing the region for this node if we already have the data (for performance e.g. DragDrop)
     * @return {Boolean} True if in region, false if not.
     */
    inRegion: function(node, node2, all, altRegion) {
        var region = {},
            r = altRegion || DOM.region(node),
            n = node2,
            off;

        if (n.tagName) {
            region = DOM.region(n);
        } else if (Y.Lang.isObject(node2)) {
            region = node2;
        } else {
            return false;
        }

        if (all) {
            return (
                r[LEFT]   >= region[LEFT]   &&
                r[RIGHT]  <= region[RIGHT]  &&
                r[TOP]    >= region[TOP]    &&
                r[BOTTOM] <= region[BOTTOM]  );
        } else {
            off = getOffsets(region, r);
            if (off[BOTTOM] >= off[TOP] && off[RIGHT] >= off[LEFT]) {
                return true;
            } else {
                return false;
            }

        }
    },

    /**
     * Check if any part of this element is in the viewport
     * @method inViewportRegion
     * @for DOM
     * @param {HTMLElement} element The DOM element.
     * @param {Boolean} all Should all of the node be inside the region
     * @param {Object} altRegion An object literal containing the region for this node if we already have the data (for performance e.g. DragDrop)
     * @return {Boolean} True if in region, false if not.
     */
    inViewportRegion: function(node, all, altRegion) {
        return DOM.inRegion(node, DOM.viewportRegion(node), all, altRegion);

    },

    _getRegion: function(t, r, b, l) {
        var region = {};

        region[TOP] = region[1] = t;
        region[LEFT] = region[0] = l;
        region[BOTTOM] = b;
        region[RIGHT] = r;
        region.width = region[RIGHT] - region[LEFT];
        region.height = region[BOTTOM] - region[TOP];

        return region;
    },

    /**
     * Returns an Object literal containing the following about the visible region of viewport: (top, right, bottom, left)
     * @method viewportRegion
     * @for DOM
     * @return {Object} Object literal containing the following about the visible region of the viewport: (top, right, bottom, left)
     */
    viewportRegion: function(node) {
        node = node || Y.config.doc.documentElement;
        var ret = false,
            scrollX,
            scrollY;

        if (node) {
            scrollX = DOM.docScrollX(node);
            scrollY = DOM.docScrollY(node);

            ret = DOM._getRegion(scrollY, // top
                DOM.winWidth(node) + scrollX, // right
                scrollY + DOM.winHeight(node), // bottom
                scrollX); // left
        }

        return ret;
    }
});
})(Y);


}, '3.17.1', {"requires": ["dom-base", "dom-style"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-screen', function (Y, NAME) {

/**
 * Extended Node interface for managing regions and screen positioning.
 * Adds support for positioning elements and normalizes window size and scroll detection.
 * @module node
 * @submodule node-screen
 */

// these are all "safe" returns, no wrapping required
Y.each([
    /**
     * Returns the inner width of the viewport (exludes scrollbar).
     * @config winWidth
     * @for Node
     * @type {Number}
     */
    'winWidth',

    /**
     * Returns the inner height of the viewport (exludes scrollbar).
     * @config winHeight
     * @type {Number}
     */
    'winHeight',

    /**
     * Document width
     * @config docWidth
     * @type {Number}
     */
    'docWidth',

    /**
     * Document height
     * @config docHeight
     * @type {Number}
     */
    'docHeight',

    /**
     * Pixel distance the page has been scrolled horizontally
     * @config docScrollX
     * @type {Number}
     */
    'docScrollX',

    /**
     * Pixel distance the page has been scrolled vertically
     * @config docScrollY
     * @type {Number}
     */
    'docScrollY'
    ],
    function(name) {
        Y.Node.ATTRS[name] = {
            getter: function() {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(Y.Node.getDOMNode(this));

                return Y.DOM[name].apply(this, args);
            }
        };
    }
);

Y.Node.ATTRS.scrollLeft = {
    getter: function() {
        var node = Y.Node.getDOMNode(this);
        return ('scrollLeft' in node) ? node.scrollLeft : Y.DOM.docScrollX(node);
    },

    setter: function(val) {
        var node = Y.Node.getDOMNode(this);
        if (node) {
            if ('scrollLeft' in node) {
                node.scrollLeft = val;
            } else if (node.document || node.nodeType === 9) {
                Y.DOM._getWin(node).scrollTo(val, Y.DOM.docScrollY(node)); // scroll window if win or doc
            }
        } else {
        }
    }
};

Y.Node.ATTRS.scrollTop = {
    getter: function() {
        var node = Y.Node.getDOMNode(this);
        return ('scrollTop' in node) ? node.scrollTop : Y.DOM.docScrollY(node);
    },

    setter: function(val) {
        var node = Y.Node.getDOMNode(this);
        if (node) {
            if ('scrollTop' in node) {
                node.scrollTop = val;
            } else if (node.document || node.nodeType === 9) {
                Y.DOM._getWin(node).scrollTo(Y.DOM.docScrollX(node), val); // scroll window if win or doc
            }
        } else {
        }
    }
};

Y.Node.importMethod(Y.DOM, [
/**
 * Gets the current position of the node in page coordinates.
 * @method getXY
 * @for Node
 * @return {Array} The XY position of the node
*/
    'getXY',

/**
 * Set the position of the node in page coordinates, regardless of how the node is positioned.
 * @method setXY
 * @param {Array} xy Contains X & Y values for new position (coordinates are page-based)
 * @chainable
 */
    'setXY',

/**
 * Gets the current position of the node in page coordinates.
 * @method getX
 * @return {Number} The X position of the node
*/
    'getX',

/**
 * Set the position of the node in page coordinates, regardless of how the node is positioned.
 * @method setX
 * @param {Number} x X value for new position (coordinates are page-based)
 * @chainable
 */
    'setX',

/**
 * Gets the current position of the node in page coordinates.
 * @method getY
 * @return {Number} The Y position of the node
*/
    'getY',

/**
 * Set the position of the node in page coordinates, regardless of how the node is positioned.
 * @method setY
 * @param {Number} y Y value for new position (coordinates are page-based)
 * @chainable
 */
    'setY',

/**
 * Swaps the XY position of this node with another node.
 * @method swapXY
 * @param {Node | HTMLElement} otherNode The node to swap with.
 * @chainable
 */
    'swapXY'
]);

/**
 * @module node
 * @submodule node-screen
 */

/**
 * Returns a region object for the node
 * @config region
 * @for Node
 * @type Node
 */
Y.Node.ATTRS.region = {
    getter: function() {
        var node = this.getDOMNode(),
            region;

        if (node && !node.tagName) {
            if (node.nodeType === 9) { // document
                node = node.documentElement;
            }
        }
        if (Y.DOM.isWindow(node)) {
            region = Y.DOM.viewportRegion(node);
        } else {
            region = Y.DOM.region(node);
        }
        return region;
    }
};

/**
 * Returns a region object for the node's viewport
 * @config viewportRegion
 * @type Node
 */
Y.Node.ATTRS.viewportRegion = {
    getter: function() {
        return Y.DOM.viewportRegion(Y.Node.getDOMNode(this));
    }
};

Y.Node.importMethod(Y.DOM, 'inViewportRegion');

// these need special treatment to extract 2nd node arg
/**
 * Compares the intersection of the node with another node or region
 * @method intersect
 * @for Node
 * @param {Node|Object} node2 The node or region to compare with.
 * @param {Object} altRegion An alternate region to use (rather than this node's).
 * @return {Object} An object representing the intersection of the regions.
 */
Y.Node.prototype.intersect = function(node2, altRegion) {
    var node1 = Y.Node.getDOMNode(this);
    if (Y.instanceOf(node2, Y.Node)) { // might be a region object
        node2 = Y.Node.getDOMNode(node2);
    }
    return Y.DOM.intersect(node1, node2, altRegion);
};

/**
 * Determines whether or not the node is within the given region.
 * @method inRegion
 * @param {Node|Object} node2 The node or region to compare with.
 * @param {Boolean} all Whether or not all of the node must be in the region.
 * @param {Object} altRegion An alternate region to use (rather than this node's).
 * @return {Boolean} True if in region, false if not.
 */
Y.Node.prototype.inRegion = function(node2, all, altRegion) {
    var node1 = Y.Node.getDOMNode(this);
    if (Y.instanceOf(node2, Y.Node)) { // might be a region object
        node2 = Y.Node.getDOMNode(node2);
    }
    return Y.DOM.inRegion(node1, node2, all, altRegion);
};


}, '3.17.1', {"requires": ["dom-screen", "node-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-style', function (Y, NAME) {

(function(Y) {
/**
 * Extended Node interface for managing node styles.
 * @module node
 * @submodule node-style
 */

Y.mix(Y.Node.prototype, {
    /**
     * Sets a style property of the node.
     * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
     * @method setStyle
     * @param {String} attr The style attribute to set.
     * @param {String|Number} val The value.
     * @chainable
     */
    setStyle: function(attr, val) {
        Y.DOM.setStyle(this._node, attr, val);
        return this;
    },

    /**
     * Sets multiple style properties on the node.
     * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
     * @method setStyles
     * @param {Object} hash An object literal of property:value pairs.
     * @chainable
     */
    setStyles: function(hash) {
        Y.DOM.setStyles(this._node, hash);
        return this;
    },

    /**
     * Returns the style's current value.
     * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
     * @method getStyle
     * @for Node
     * @param {String} attr The style attribute to retrieve.
     * @return {String} The current value of the style property for the element.
     */

     getStyle: function(attr) {
        return Y.DOM.getStyle(this._node, attr);
     },

    /**
     * Returns the computed value for the given style property.
     * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
     * @method getComputedStyle
     * @param {String} attr The style attribute to retrieve.
     * @return {String} The computed value of the style property for the element.
     */
     getComputedStyle: function(attr) {
        return Y.DOM.getComputedStyle(this._node, attr);
     }
});

/**
 * Returns an array of values for each node.
 * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
 * @method getStyle
 * @for NodeList
 * @see Node.getStyle
 * @param {String} attr The style attribute to retrieve.
 * @return {Array} The current values of the style property for the element.
 */

/**
 * Returns an array of the computed value for each node.
 * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
 * @method getComputedStyle
 * @see Node.getComputedStyle
 * @param {String} attr The style attribute to retrieve.
 * @return {Array} The computed values for each node.
 */

/**
 * Sets a style property on each node.
 * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
 * @method setStyle
 * @see Node.setStyle
 * @param {String} attr The style attribute to set.
 * @param {String|Number} val The value.
 * @chainable
 */

/**
 * Sets multiple style properties on each node.
 * Use camelCase (e.g. 'backgroundColor') for multi-word properties.
 * @method setStyles
 * @see Node.setStyles
 * @param {Object} hash An object literal of property:value pairs.
 * @chainable
 */

// These are broken out to handle undefined return (avoid false positive for
// chainable)

Y.NodeList.importMethod(Y.Node.prototype, ['getStyle', 'getComputedStyle', 'setStyle', 'setStyles']);
})(Y);
/**
 * @module node
 * @submodule node-base
 */

var Y_Node = Y.Node;

Y.mix(Y_Node.prototype, {
    /**
     * Makes the node visible.
     * If the "transition" module is loaded, show optionally
     * animates the showing of the node using either the default
     * transition effect ('fadeIn'), or the given named effect.
     * @method show
     * @for Node
     * @param {String} name A named Transition effect to use as the show effect.
     * @param {Object} config Options to use with the transition.
     * @param {Function} callback An optional function to run after the transition completes.
     * @chainable
     */
    show: function(callback) {
        callback = arguments[arguments.length - 1];
        this.toggleView(true, callback);
        return this;
    },

    /**
     * The implementation for showing nodes.
     * Default is to remove the hidden attribute and reset the CSS style.display property.
     * @method _show
     * @protected
     * @chainable
     */
    _show: function() {
        this.removeAttribute('hidden');

        // For back-compat we need to leave this in for browsers that
        // do not visually hide a node via the hidden attribute
        // and for users that check visibility based on style display.
        this.setStyle('display', '');

    },

    /**
    Returns whether the node is hidden by YUI or not. The hidden status is
    determined by the 'hidden' attribute and the value of the 'display' CSS
    property.

    @method _isHidden
    @return {Boolean} `true` if the node is hidden.
    @private
    **/
    _isHidden: function() {
        return  this.hasAttribute('hidden') || Y.DOM.getComputedStyle(this._node, 'display') === 'none';
    },

    /**
     * Displays or hides the node.
     * If the "transition" module is loaded, toggleView optionally
     * animates the toggling of the node using given named effect.
     * @method toggleView
     * @for Node
     * @param {Boolean} [on] An optional boolean value to force the node to be shown or hidden
     * @param {Function} [callback] An optional function to run after the transition completes.
     * @chainable
     */
    toggleView: function(on, callback) {
        this._toggleView.apply(this, arguments);
        return this;
    },

    _toggleView: function(on, callback) {
        callback = arguments[arguments.length - 1];

        // base on current state if not forcing
        if (typeof on != 'boolean') {
            on = (this._isHidden()) ? 1 : 0;
        }

        if (on) {
            this._show();
        }  else {
            this._hide();
        }

        if (typeof callback == 'function') {
            callback.call(this);
        }

        return this;
    },

    /**
     * Hides the node.
     * If the "transition" module is loaded, hide optionally
     * animates the hiding of the node using either the default
     * transition effect ('fadeOut'), or the given named effect.
     * @method hide
     * @param {String} name A named Transition effect to use as the show effect.
     * @param {Object} config Options to use with the transition.
     * @param {Function} callback An optional function to run after the transition completes.
     * @chainable
     */
    hide: function(callback) {
        callback = arguments[arguments.length - 1];
        this.toggleView(false, callback);
        return this;
    },

    /**
     * The implementation for hiding nodes.
     * Default is to set the hidden attribute to true and set the CSS style.display to 'none'.
     * @method _hide
     * @protected
     * @chainable
     */
    _hide: function() {
        this.setAttribute('hidden', 'hidden');

        // For back-compat we need to leave this in for browsers that
        // do not visually hide a node via the hidden attribute
        // and for users that check visibility based on style display.
        this.setStyle('display', 'none');
    }
});

Y.NodeList.importMethod(Y.Node.prototype, [
    /**
     * Makes each node visible.
     * If the "transition" module is loaded, show optionally
     * animates the showing of the node using either the default
     * transition effect ('fadeIn'), or the given named effect.
     * @method show
     * @param {String} name A named Transition effect to use as the show effect.
     * @param {Object} config Options to use with the transition.
     * @param {Function} callback An optional function to run after the transition completes.
     * @for NodeList
     * @chainable
     */
    'show',

    /**
     * Hides each node.
     * If the "transition" module is loaded, hide optionally
     * animates the hiding of the node using either the default
     * transition effect ('fadeOut'), or the given named effect.
     * @method hide
     * @param {String} name A named Transition effect to use as the show effect.
     * @param {Object} config Options to use with the transition.
     * @param {Function} callback An optional function to run after the transition completes.
     * @chainable
     */
    'hide',

    /**
     * Displays or hides each node.
     * If the "transition" module is loaded, toggleView optionally
     * animates the toggling of the nodes using given named effect.
     * @method toggleView
     * @param {Boolean} [on] An optional boolean value to force the nodes to be shown or hidden
     * @param {Function} [callback] An optional function to run after the transition completes.
     * @chainable
     */
    'toggleView'
]);


}, '3.17.1', {"requires": ["dom-style", "node-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('node-base', function (Y, NAME) {

/**
 * @module node
 * @submodule node-base
 */

var methods = [
/**
 * Determines whether the node has the given className.
 * @method hasClass
 * @for Node
 * @param {String} className the class name to search for
 * @return {Boolean} Whether or not the node has the specified class
 */
 'hasClass',

/**
 * Adds a class name to the node.
 * @method addClass
 * @param {String} className the class name to add to the node's class attribute
 * @chainable
 */
 'addClass',

/**
 * Removes a class name from the node.
 * @method removeClass
 * @param {String} className the class name to remove from the node's class attribute
 * @chainable
 */
 'removeClass',

/**
 * Replace a class with another class on the node.
 * If no oldClassName is present, the newClassName is simply added.
 * @method replaceClass
 * @param {String} oldClassName the class name to be replaced
 * @param {String} newClassName the class name that will be replacing the old class name
 * @chainable
 */
 'replaceClass',

/**
 * If the className exists on the node it is removed, if it doesn't exist it is added.
 * @method toggleClass
 * @param {String} className the class name to be toggled
 * @param {Boolean} force Option to force adding or removing the class.
 * @chainable
 */
 'toggleClass'
];

Y.Node.importMethod(Y.DOM, methods);
/**
 * Determines whether each node has the given className.
 * @method hasClass
 * @see Node.hasClass
 * @for NodeList
 * @param {String} className the class name to search for
 * @return {Array} An array of booleans for each node bound to the NodeList.
 */

/**
 * Adds a class name to each node.
 * @method addClass
 * @see Node.addClass
 * @param {String} className the class name to add to each node's class attribute
 * @chainable
 */

/**
 * Removes a class name from each node.
 * @method removeClass
 * @see Node.removeClass
 * @param {String} className the class name to remove from each node's class attribute
 * @chainable
 */

/**
 * Replace a class with another class for each node.
 * If no oldClassName is present, the newClassName is simply added.
 * @method replaceClass
 * @see Node.replaceClass
 * @param {String} oldClassName the class name to be replaced
 * @param {String} newClassName the class name that will be replacing the old class name
 * @chainable
 */

/**
 * For each node, if the className exists on the node it is removed, if it doesn't exist it is added.
 * @method toggleClass
 * @see Node.toggleClass
 * @param {String} className the class name to be toggled
 * @chainable
 */
Y.NodeList.importMethod(Y.Node.prototype, methods);
/**
 * @module node
 * @submodule node-base
 */

var Y_Node = Y.Node,
    Y_DOM = Y.DOM;

/**
 * Returns a new dom node using the provided markup string.
 * @method create
 * @static
 * @param {String} html The markup used to create the element.
 * Use <a href="../classes/Escape.html#method_html">`Y.Escape.html()`</a>
 * to escape html content.
 * @param {HTMLDocument} doc An optional document context
 * @return {Node} A Node instance bound to a DOM node or fragment
 * @for Node
 */
Y_Node.create = function(html, doc) {
    if (doc && doc._node) {
        doc = doc._node;
    }
    return Y.one(Y_DOM.create(html, doc));
};

Y.mix(Y_Node.prototype, {
    /**
     * Creates a new Node using the provided markup string.
     * @method create
     * @param {String} html The markup used to create the element.
     * Use <a href="../classes/Escape.html#method_html">`Y.Escape.html()`</a>
     * to escape html content.
     * @param {HTMLDocument} doc An optional document context
     * @return {Node} A Node instance bound to a DOM node or fragment
     */
    create: Y_Node.create,

    /**
     * Inserts the content before the reference node.
     * @method insert
     * @param {String | Node | HTMLElement | NodeList | HTMLCollection} content The content to insert.
     * Use <a href="../classes/Escape.html#method_html">`Y.Escape.html()`</a>
     * to escape html content.
     * @param {Int | Node | HTMLElement | String} where The position to insert at.
     * Possible "where" arguments
     * <dl>
     * <dt>Y.Node</dt>
     * <dd>The Node to insert before</dd>
     * <dt>HTMLElement</dt>
     * <dd>The element to insert before</dd>
     * <dt>Int</dt>
     * <dd>The index of the child element to insert before</dd>
     * <dt>"replace"</dt>
     * <dd>Replaces the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts before the existing HTML</dd>
     * <dt>"before"</dt>
     * <dd>Inserts content before the node</dd>
     * <dt>"after"</dt>
     * <dd>Inserts content after the node</dd>
     * </dl>
     * @chainable
     */
    insert: function(content, where) {
        this._insert(content, where);
        return this;
    },

    _insert: function(content, where) {
        var node = this._node,
            ret = null;

        if (typeof where == 'number') { // allow index
            where = this._node.childNodes[where];
        } else if (where && where._node) { // Node
            where = where._node;
        }

        if (content && typeof content != 'string') { // allow Node or NodeList/Array instances
            content = content._node || content._nodes || content;
        }
        ret = Y_DOM.addHTML(node, content, where);

        return ret;
    },

    /**
     * Inserts the content as the firstChild of the node.
     * @method prepend
     * @param {String | Node | HTMLElement} content The content to insert.
     * Use <a href="../classes/Escape.html#method_html">`Y.Escape.html()`</a>
     * to escape html content.
     * @chainable
     */
    prepend: function(content) {
        return this.insert(content, 0);
    },

    /**
     * Inserts the content as the lastChild of the node.
     * @method append
     * @param {String | Node | HTMLElement} content The content to insert.
     * Use <a href="../classes/Escape.html#method_html">`Y.Escape.html()`</a>
     * to escape html content.
     * @chainable
     */
    append: function(content) {
        return this.insert(content, null);
    },

    /**
     * @method appendChild
     * @param {String | HTMLElement | Node} node Node to be appended.
     * Use <a href="../classes/Escape.html#method_html">`Y.Escape.html()`</a>
     * to escape html content.
     * @return {Node} The appended node
     */
    appendChild: function(node) {
        return Y_Node.scrubVal(this._insert(node));
    },

    /**
     * @method insertBefore
     * @param {String | HTMLElement | Node} newNode Node to be appended
     * @param {HTMLElement | Node} refNode Node to be inserted before.
     * Use <a href="../classes/Escape.html#method_html">`Y.Escape.html()`</a>
     * to escape html content.
     * @return {Node} The inserted node
     */
    insertBefore: function(newNode, refNode) {
        return Y.Node.scrubVal(this._insert(newNode, refNode));
    },

    /**
     * Appends the node to the given node.
     * @example
     *      // appendTo returns the node that has been created beforehand
     *      Y.Node.create('<p></p>').appendTo('body').set('text', 'hello world!');
     * @method appendTo
     * @param {Node | HTMLElement | String} node The node to append to.
     *  If `node` is a string it will be considered as a css selector and only the first matching node will be used.
     * @chainable
     */
    appendTo: function(node) {
        Y.one(node).append(this);
        return this;
    },
    
    // This method is deprecated, and is intentionally left undocumented.
    // Use `setHTML` instead.
    setContent: function(content) {
        this._insert(content, 'replace');
        return this;
    },
    
    // This method is deprecated, and is intentionally left undocumented.
    // Use `getHTML` instead.
    getContent: function() {
        var node = this;

        if (node._node.nodeType === 11) { // 11 === Node.DOCUMENT_FRAGMENT_NODE
            // "this", when it is a document fragment, must be cloned because
            // the nodes contained in the fragment actually disappear once
            // the fragment is appended anywhere
            node = node.create("<div/>").append(node.cloneNode(true));
        }

        return node.get("innerHTML");
    }
});

/**
 * Replaces the node's current html content with the content provided.
 * Note that this passes to innerHTML and is not escaped.
 * Use <a href="../classes/Escape.html#method_html">`Y.Escape.html()`</a>
 * to escape html content or `set('text')` to add as text.
 * @method setHTML
 * @param {String | Node | HTMLElement | NodeList | HTMLCollection} content The content to insert
 * @chainable
 */
Y.Node.prototype.setHTML = Y.Node.prototype.setContent;

/**
 * Returns the node's current html content (e.g. innerHTML)
 * @method getHTML
 * @return {String} The html content
 */
Y.Node.prototype.getHTML = Y.Node.prototype.getContent;

Y.NodeList.importMethod(Y.Node.prototype, [
    /**
     * Called on each Node instance
     * @for NodeList
     * @method append
     * @see Node.append
     */
    'append',

    /**
     * Called on each Node instance
     * @for NodeList
     * @method insert
     * @see Node.insert
     */
    'insert',

    /**
     * Called on each Node instance
     * @for NodeList
     * @method appendChild
     * @see Node.appendChild
     */
    'appendChild',

    /**
     * Called on each Node instance
     * @for NodeList
     * @method insertBefore
     * @see Node.insertBefore
     */
    'insertBefore',

    /**
     * Called on each Node instance
     * @for NodeList
     * @method prepend
     * @see Node.prepend
     */
    'prepend',

    'setContent',

    'getContent',

    /**
     * Called on each Node instance
     * Note that this passes to innerHTML and is not escaped.
     * Use <a href="../classes/Escape.html#method_html">`Y.Escape.html()`</a>
     * to escape html content or `set('text')` to add as text.
     * @for NodeList
     * @method setHTML
     * @see Node.setHTML
     */
    'setHTML',

    /**
     * Called on each Node instance
     * @for NodeList
     * @method getHTML
     * @see Node.getHTML
     */
    'getHTML'
]);
/**
 * @module node
 * @submodule node-base
 */

var Y_Node = Y.Node,
    Y_DOM = Y.DOM;

/**
 * Static collection of configuration attributes for special handling
 * @property ATTRS
 * @static
 * @type object
 */
Y_Node.ATTRS = {
    /**
     * Allows for getting and setting the text of an element.
     * Formatting is preserved and special characters are treated literally.
     * @config text
     * @type String
     */
    text: {
        getter: function() {
            return Y_DOM.getText(this._node);
        },

        setter: function(content) {
            Y_DOM.setText(this._node, content);
            return content;
        }
    },

    /**
     * Allows for getting and setting the text of an element.
     * Formatting is preserved and special characters are treated literally.
     * @config for
     * @type String
     */
    'for': {
        getter: function() {
            return Y_DOM.getAttribute(this._node, 'for');
        },

        setter: function(val) {
            Y_DOM.setAttribute(this._node, 'for', val);
            return val;
        }
    },

    'options': {
        getter: function() {
            return this._node.getElementsByTagName('option');
        }
    },

    /**
     * Returns a NodeList instance of all HTMLElement children.
     * @readOnly
     * @config children
     * @type NodeList
     */
    'children': {
        getter: function() {
            var node = this._node,
                children = node.children,
                childNodes, i, len;

            if (!children) {
                childNodes = node.childNodes;
                children = [];

                for (i = 0, len = childNodes.length; i < len; ++i) {
                    if (childNodes[i].tagName) {
                        children[children.length] = childNodes[i];
                    }
                }
            }
            return Y.all(children);
        }
    },

    value: {
        getter: function() {
            return Y_DOM.getValue(this._node);
        },

        setter: function(val) {
            Y_DOM.setValue(this._node, val);
            return val;
        }
    }
};

Y.Node.importMethod(Y.DOM, [
    /**
     * Allows setting attributes on DOM nodes, normalizing in some cases.
     * This passes through to the DOM node, allowing for custom attributes.
     * @method setAttribute
     * @for Node
     * @for NodeList
     * @chainable
     * @param {string} name The attribute name
     * @param {string} value The value to set
     */
    'setAttribute',
    /**
     * Allows getting attributes on DOM nodes, normalizing in some cases.
     * This passes through to the DOM node, allowing for custom attributes.
     * @method getAttribute
     * @for Node
     * @for NodeList
     * @param {string} name The attribute name
     * @return {string} The attribute value
     */
    'getAttribute'

]);
/**
 * @module node
 * @submodule node-base
 */

var Y_Node = Y.Node;
var Y_NodeList = Y.NodeList;
/**
 * List of events that route to DOM events
 * @static
 * @property DOM_EVENTS
 * @for Node
 */

Y_Node.DOM_EVENTS = {
    abort: 1,
    beforeunload: 1,
    blur: 1,
    change: 1,
    click: 1,
    close: 1,
    command: 1,
    contextmenu: 1,
    copy: 1,
    cut: 1,
    dblclick: 1,
    DOMMouseScroll: 1,
    drag: 1,
    dragstart: 1,
    dragenter: 1,
    dragover: 1,
    dragleave: 1,
    dragend: 1,
    drop: 1,
    error: 1,
    focus: 1,
    key: 1,
    keydown: 1,
    keypress: 1,
    keyup: 1,
    load: 1,
    message: 1,
    mousedown: 1,
    mouseenter: 1,
    mouseleave: 1,
    mousemove: 1,
    mousemultiwheel: 1,
    mouseout: 1,
    mouseover: 1,
    mouseup: 1,
    mousewheel: 1,
    orientationchange: 1,
    paste: 1,
    reset: 1,
    resize: 1,
    select: 1,
    selectstart: 1,
    submit: 1,
    scroll: 1,
    textInput: 1,
    unload: 1,
    invalid: 1
};

// Add custom event adaptors to this list.  This will make it so
// that delegate, key, available, contentready, etc all will
// be available through Node.on
Y.mix(Y_Node.DOM_EVENTS, Y.Env.evt.plugins);

Y.augment(Y_Node, Y.EventTarget);

Y.mix(Y_Node.prototype, {
    /**
     * Removes event listeners from the node and (optionally) its subtree
     * @method purge
     * @param {Boolean} recurse (optional) Whether or not to remove listeners from the
     * node's subtree
     * @param {String} type (optional) Only remove listeners of the specified type
     * @chainable
     *
     */
    purge: function(recurse, type) {
        Y.Event.purgeElement(this._node, recurse, type);
        return this;
    }

});

Y.mix(Y.NodeList.prototype, {
    _prepEvtArgs: function(type, fn, context) {
        // map to Y.on/after signature (type, fn, nodes, context, arg1, arg2, etc)
        var args = Y.Array(arguments, 0, true);

        if (args.length < 2) { // type only (event hash) just add nodes
            args[2] = this._nodes;
        } else {
            args.splice(2, 0, this._nodes);
        }

        args[3] = context || this; // default to NodeList instance as context

        return args;
    },

    /**
    Subscribe a callback function for each `Node` in the collection to execute
    in response to a DOM event.

    NOTE: Generally, the `on()` method should be avoided on `NodeLists`, in
    favor of using event delegation from a parent Node.  See the Event user
    guide for details.

    Most DOM events are associated with a preventable default behavior, such as
    link clicks navigating to a new page.  Callbacks are passed a
    `DOMEventFacade` object as their first argument (usually called `e`) that
    can be used to prevent this default behavior with `e.preventDefault()`. See
    the `DOMEventFacade` API for all available properties and methods on the
    object.

    By default, the `this` object will be the `NodeList` that the subscription
    came from, <em>not the `Node` that received the event</em>.  Use
    `e.currentTarget` to refer to the `Node`.

    Returning `false` from a callback is supported as an alternative to calling
    `e.preventDefault(); e.stopPropagation();`.  However, it is recommended to
    use the event methods.

    @example

        Y.all(".sku").on("keydown", function (e) {
            if (e.keyCode === 13) {
                e.preventDefault();

                // Use e.currentTarget to refer to the individual Node
                var item = Y.MyApp.searchInventory( e.currentTarget.get('value') );
                // etc ...
            }
        });

    @method on
    @param {String} type The name of the event
    @param {Function} fn The callback to execute in response to the event
    @param {Object} [context] Override `this` object in callback
    @param {Any} [arg*] 0..n additional arguments to supply to the subscriber
    @return {EventHandle} A subscription handle capable of detaching that
                          subscription
    @for NodeList
    **/
    on: function(type, fn, context) {
        return Y.on.apply(Y, this._prepEvtArgs.apply(this, arguments));
    },

    /**
     * Applies an one-time event listener to each Node bound to the NodeList.
     * @method once
     * @param {String} type The event being listened for
     * @param {Function} fn The handler to call when the event fires
     * @param {Object} context The context to call the handler with.
     * Default is the NodeList instance.
     * @return {EventHandle} A subscription handle capable of detaching that
     *                    subscription
     * @for NodeList
     */
    once: function(type, fn, context) {
        return Y.once.apply(Y, this._prepEvtArgs.apply(this, arguments));
    },

    /**
     * Applies an event listener to each Node bound to the NodeList.
     * The handler is called only after all on() handlers are called
     * and the event is not prevented.
     * @method after
     * @param {String} type The event being listened for
     * @param {Function} fn The handler to call when the event fires
     * @param {Object} context The context to call the handler with.
     * Default is the NodeList instance.
     * @return {EventHandle} A subscription handle capable of detaching that
     *                    subscription
     * @for NodeList
     */
    after: function(type, fn, context) {
        return Y.after.apply(Y, this._prepEvtArgs.apply(this, arguments));
    },

    /**
     * Applies an one-time event listener to each Node bound to the NodeList
     * that will be called only after all on() handlers are called and the
     * event is not prevented.
     *
     * @method onceAfter
     * @param {String} type The event being listened for
     * @param {Function} fn The handler to call when the event fires
     * @param {Object} context The context to call the handler with.
     * Default is the NodeList instance.
     * @return {EventHandle} A subscription handle capable of detaching that
     *                    subscription
     * @for NodeList
     */
    onceAfter: function(type, fn, context) {
        return Y.onceAfter.apply(Y, this._prepEvtArgs.apply(this, arguments));
    }
});

Y_NodeList.importMethod(Y.Node.prototype, [
    /**
      * Called on each Node instance
      * @method detach
      * @see Node.detach
      * @for NodeList
      */
    'detach',

    /** Called on each Node instance
      * @method detachAll
      * @see Node.detachAll
      * @for NodeList
      */
    'detachAll'
]);

/**
Subscribe a callback function to execute in response to a DOM event or custom
event.

Most DOM events are associated with a preventable default behavior such as
link clicks navigating to a new page.  Callbacks are passed a `DOMEventFacade`
object as their first argument (usually called `e`) that can be used to
prevent this default behavior with `e.preventDefault()`. See the
`DOMEventFacade` API for all available properties and methods on the object.

If the event name passed as the first parameter is not a whitelisted DOM event,
it will be treated as a custom event subscriptions, allowing
`node.fire('customEventName')` later in the code.  Refer to the Event user guide
for the full DOM event whitelist.

By default, the `this` object in the callback will refer to the subscribed
`Node`.

Returning `false` from a callback is supported as an alternative to calling
`e.preventDefault(); e.stopPropagation();`.  However, it is recommended to use
the event methods.

@example

    Y.one("#my-form").on("submit", function (e) {
        e.preventDefault();

        // proceed with ajax form submission instead...
    });

@method on
@param {String} type The name of the event
@param {Function} fn The callback to execute in response to the event
@param {Object} [context] Override `this` object in callback
@param {Any} [arg*] 0..n additional arguments to supply to the subscriber
@return {EventHandle} A subscription handle capable of detaching that
                      subscription
@for Node
**/

Y.mix(Y.Node.ATTRS, {
    offsetHeight: {
        setter: function(h) {
            Y.DOM.setHeight(this._node, h);
            return h;
        },

        getter: function() {
            return this._node.offsetHeight;
        }
    },

    offsetWidth: {
        setter: function(w) {
            Y.DOM.setWidth(this._node, w);
            return w;
        },

        getter: function() {
            return this._node.offsetWidth;
        }
    }
});

Y.mix(Y.Node.prototype, {
    sizeTo: function(w, h) {
        var node;
        if (arguments.length < 2) {
            node = Y.one(w);
            w = node.get('offsetWidth');
            h = node.get('offsetHeight');
        }

        this.setAttrs({
            offsetWidth: w,
            offsetHeight: h
        });
    }
});

if (!Y.config.doc.documentElement.hasAttribute) { // IE < 8
    Y.Node.prototype.hasAttribute = function(attr) {
        if (attr === 'value') {
            if (this.get('value') !== "") { // IE < 8 fails to populate specified when set in HTML
                return true;
            }
        }
        return !!(this._node.attributes[attr] &&
                this._node.attributes[attr].specified);
    };
}

// IE throws an error when calling focus() on an element that's invisible, not
// displayed, or disabled.
Y.Node.prototype.focus = function () {
    try {
        this._node.focus();
    } catch (e) {
    }

    return this;
};

// IE throws error when setting input.type = 'hidden',
// input.setAttribute('type', 'hidden') and input.attributes.type.value = 'hidden'
Y.Node.ATTRS.type = {
    setter: function(val) {
        if (val === 'hidden') {
            try {
                this._node.type = 'hidden';
            } catch(e) {
                this._node.style.display = 'none';
                this._inputType = 'hidden';
            }
        } else {
            try { // IE errors when changing the type from "hidden'
                this._node.type = val;
            } catch (e) {
            }
        }
        return val;
    },

    getter: function() {
        return this._inputType || this._node.type;
    },

    _bypassProxy: true // don't update DOM when using with Attribute
};

if (Y.config.doc.createElement('form').elements.nodeType) {
    // IE: elements collection is also FORM node which trips up scrubVal.
    Y.Node.ATTRS.elements = {
            getter: function() {
                return this.all('input, textarea, button, select');
            }
    };
}
/**
 * Provides methods for managing custom Node data.
 *
 * @module node
 * @main node
 * @submodule node-data
 */

Y.mix(Y.Node.prototype, {
    _initData: function() {
        if (! ('_data' in this)) {
            this._data = {};
        }
    },

    /**
    * @method getData
    * @for Node
    * @description Retrieves arbitrary data stored on a Node instance.
    * If no data is associated with the Node, it will attempt to retrieve
    * a value from the corresponding HTML data attribute. (e.g. node.getData('foo')
    * will check node.getAttribute('data-foo')).
    * @param {string} name Optional name of the data field to retrieve.
    * If no name is given, all data is returned.
    * @return {any | Object} Whatever is stored at the given field,
    * or an object hash of all fields.
    */
    getData: function(name) {
        this._initData();
        var data = this._data,
            ret = data;

        if (arguments.length) { // single field
            if (name in data) {
                ret = data[name];
            } else { // initialize from HTML attribute
                ret = this._getDataAttribute(name);
            }
        } else if (typeof data == 'object' && data !== null) { // all fields
            ret = {};
            Y.Object.each(data, function(v, n) {
                ret[n] = v;
            });

            ret = this._getDataAttributes(ret);
        }

        return ret;

    },

    _getDataAttributes: function(ret) {
        ret = ret || {};
        var i = 0,
            attrs = this._node.attributes,
            len = attrs.length,
            prefix = this.DATA_PREFIX,
            prefixLength = prefix.length,
            name;

        while (i < len) {
            name = attrs[i].name;
            if (name.indexOf(prefix) === 0) {
                name = name.substr(prefixLength);
                if (!(name in ret)) { // only merge if not already stored
                    ret[name] = this._getDataAttribute(name);
                }
            }

            i += 1;
        }

        return ret;
    },

    _getDataAttribute: function(name) {
        name = this.DATA_PREFIX + name;

        var node = this._node,
            attrs = node.attributes,
            data = attrs && attrs[name] && attrs[name].value;

        return data;
    },

    /**
    * @method setData
    * @for Node
    * @description Stores arbitrary data on a Node instance.
    * This is not stored with the DOM node.
    * @param {string} name The name of the field to set. If no val
    * is given, name is treated as the data and overrides any existing data.
    * @param {any} val The value to be assigned to the field.
    * @chainable
    */
    setData: function(name, val) {
        this._initData();
        if (arguments.length > 1) {
            this._data[name] = val;
        } else {
            this._data = name;
        }

       return this;
    },

    /**
    * @method clearData
    * @for Node
    * @description Clears internally stored data.
    * @param {string} name The name of the field to clear. If no name
    * is given, all data is cleared.
    * @chainable
    */
    clearData: function(name) {
        if ('_data' in this) {
            if (typeof name != 'undefined') {
                delete this._data[name];
            } else {
                delete this._data;
            }
        }

        return this;
    }
});

Y.mix(Y.NodeList.prototype, {
    /**
    * @method getData
    * @for NodeList
    * @description Retrieves arbitrary data stored on each Node instance
    * bound to the NodeList.
    * @see Node
    * @param {string} name Optional name of the data field to retrieve.
    * If no name is given, all data is returned.
    * @return {Array} An array containing all of the data for each Node instance.
    * or an object hash of all fields.
    */
    getData: function(name) {
        var args = (arguments.length) ? [name] : [];
        return this._invoke('getData', args, true);
    },

    /**
    * @method setData
    * @for NodeList
    * @description Stores arbitrary data on each Node instance bound to the
    *  NodeList. This is not stored with the DOM node.
    * @param {string} name The name of the field to set. If no name
    * is given, name is treated as the data and overrides any existing data.
    * @param {any} val The value to be assigned to the field.
    * @chainable
    */
    setData: function(name, val) {
        var args = (arguments.length > 1) ? [name, val] : [name];
        return this._invoke('setData', args);
    },

    /**
    * @method clearData
    * @for NodeList
    * @description Clears data on all Node instances bound to the NodeList.
    * @param {string} name The name of the field to clear. If no name
    * is given, all data is cleared.
    * @chainable
    */
    clearData: function(name) {
        var args = (arguments.length) ? [name] : [];
        return this._invoke('clearData', [name]);
    }
});


}, '3.17.1', {"requires": ["event-base", "node-core", "dom-base", "dom-style"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-synthetic', function (Y, NAME) {

/**
 * Define new DOM events that can be subscribed to from Nodes.
 *
 * @module event
 * @submodule event-synthetic
 */
var CustomEvent = Y.CustomEvent,
    DOMMap   = Y.Env.evt.dom_map,
    toArray  = Y.Array,
    YLang    = Y.Lang,
    isObject = YLang.isObject,
    isString = YLang.isString,
    isArray  = YLang.isArray,
    query    = Y.Selector.query,
    noop     = function () {};

/**
 * <p>The triggering mechanism used by SyntheticEvents.</p>
 *
 * <p>Implementers should not instantiate these directly.  Use the Notifier
 * provided to the event's implemented <code>on(node, sub, notifier)</code> or
 * <code>delegate(node, sub, notifier, filter)</code> methods.</p>
 *
 * @class SyntheticEvent.Notifier
 * @constructor
 * @param handle {EventHandle} the detach handle for the subscription to an
 *              internal custom event used to execute the callback passed to
 *              on(..) or delegate(..)
 * @param emitFacade {Boolean} take steps to ensure the first arg received by
 *              the subscription callback is an event facade
 * @private
 * @since 3.2.0
 */
function Notifier(handle, emitFacade) {
    this.handle     = handle;
    this.emitFacade = emitFacade;
}

/**
 * <p>Executes the subscription callback, passing the firing arguments as the
 * first parameters to that callback. For events that are configured with
 * emitFacade=true, it is common practice to pass the triggering DOMEventFacade
 * as the first parameter.  Barring a proper DOMEventFacade or EventFacade
 * (from a CustomEvent), a new EventFacade will be generated.  In that case, if
 * fire() is called with a simple object, it will be mixed into the facade.
 * Otherwise, the facade will be prepended to the callback parameters.</p>
 *
 * <p>For notifiers provided to delegate logic, the first argument should be an
 * object with a &quot;currentTarget&quot; property to identify what object to
 * default as 'this' in the callback.  Typically this is gleaned from the
 * DOMEventFacade or EventFacade, but if configured with emitFacade=false, an
 * object must be provided.  In that case, the object will be removed from the
 * callback parameters.</p>
 *
 * <p>Additional arguments passed during event subscription will be
 * automatically added after those passed to fire().</p>
 *
 * @method fire
 * @param {EventFacade|DOMEventFacade|any} e (see description)
 * @param {any[]} [arg*] additional arguments received by all subscriptions
 * @private
 */
Notifier.prototype.fire = function (e) {
    // first arg to delegate notifier should be an object with currentTarget
    var args     = toArray(arguments, 0, true),
        handle   = this.handle,
        ce       = handle.evt,
        sub      = handle.sub,
        thisObj  = sub.context,
        delegate = sub.filter,
        event    = e || {},
        ret;

    if (this.emitFacade) {
        if (!e || !e.preventDefault) {
            event = ce._getFacade();

            if (isObject(e) && !e.preventDefault) {
                Y.mix(event, e, true);
                args[0] = event;
            } else {
                args.unshift(event);
            }
        }

        event.type    = ce.type;
        event.details = args.slice();

        if (delegate) {
            event.container = ce.host;
        }
    } else if (delegate && isObject(e) && e.currentTarget) {
        args.shift();
    }

    sub.context = thisObj || event.currentTarget || ce.host;
    ret = ce.fire.apply(ce, args);

    // have to handle preventedFn and stoppedFn manually because
    // Notifier CustomEvents are forced to emitFacade=false
    if (e.prevented && ce.preventedFn) {
        ce.preventedFn.apply(ce, args);
    }

    if (e.stopped && ce.stoppedFn) {
        ce.stoppedFn.apply(ce, args);
    }

    sub.context = thisObj; // reset for future firing

    // to capture callbacks that return false to stopPropagation.
    // Useful for delegate implementations
    return ret;
};

/**
 * Manager object for synthetic event subscriptions to aggregate multiple synths on the
 * same node without colliding with actual DOM subscription entries in the global map of
 * DOM subscriptions.  Also facilitates proper cleanup on page unload.
 *
 * @class SynthRegistry
 * @constructor
 * @param el {HTMLElement} the DOM element
 * @param yuid {String} the yuid stamp for the element
 * @param key {String} the generated id token used to identify an event type +
 *                     element in the global DOM subscription map.
 * @private
 */
function SynthRegistry(el, yuid, key) {
    this.handles = [];
    this.el      = el;
    this.key     = key;
    this.domkey  = yuid;
}

SynthRegistry.prototype = {
    constructor: SynthRegistry,

    // A few object properties to fake the CustomEvent interface for page
    // unload cleanup.  DON'T TOUCH!
    type      : '_synth',
    fn        : noop,
    capture   : false,

    /**
     * Adds a subscription from the Notifier registry.
     *
     * @method register
     * @param handle {EventHandle} the subscription
     * @since 3.4.0
     */
    register: function (handle) {
        handle.evt.registry = this;
        this.handles.push(handle);
    },

    /**
     * Removes the subscription from the Notifier registry.
     *
     * @method _unregisterSub
     * @param sub {Subscription} the subscription
     * @since 3.4.0
     */
    unregister: function (sub) {
        var handles = this.handles,
            events = DOMMap[this.domkey],
            i;

        for (i = handles.length - 1; i >= 0; --i) {
            if (handles[i].sub === sub) {
                handles.splice(i, 1);
                break;
            }
        }

        // Clean up left over objects when there are no more subscribers.
        if (!handles.length) {
            delete events[this.key];
            if (!Y.Object.size(events)) {
                delete DOMMap[this.domkey];
            }
        }
    },

    /**
     * Used by the event system's unload cleanup process.  When navigating
     * away from the page, the event system iterates the global map of element
     * subscriptions and detaches everything using detachAll().  Normally,
     * the map is populated with custom events, so this object needs to
     * at least support the detachAll method to duck type its way to
     * cleanliness.
     *
     * @method detachAll
     * @private
     * @since 3.4.0
     */
    detachAll : function () {
        var handles = this.handles,
            i = handles.length;

        while (--i >= 0) {
            handles[i].detach();
        }
    }
};

/**
 * <p>Wrapper class for the integration of new events into the YUI event
 * infrastructure.  Don't instantiate this object directly, use
 * <code>Y.Event.define(type, config)</code>.  See that method for details.</p>
 *
 * <p>Properties that MAY or SHOULD be specified in the configuration are noted
 * below and in the description of <code>Y.Event.define</code>.</p>
 *
 * @class SyntheticEvent
 * @constructor
 * @param cfg {Object} Implementation pieces and configuration
 * @since 3.1.0
 * @in event-synthetic
 */
function SyntheticEvent() {
    this._init.apply(this, arguments);
}

Y.mix(SyntheticEvent, {
    Notifier: Notifier,
    SynthRegistry: SynthRegistry,

    /**
     * Returns the array of subscription handles for a node for the given event
     * type.  Passing true as the third argument will create a registry entry
     * in the event system's DOM map to host the array if one doesn't yet exist.
     *
     * @method getRegistry
     * @param node {Node} the node
     * @param type {String} the event
     * @param create {Boolean} create a registration entry to host a new array
     *                  if one doesn't exist.
     * @return {Array}
     * @static
     * @protected
     * @since 3.2.0
     */
    getRegistry: function (node, type, create) {
        var el     = node._node,
            yuid   = Y.stamp(el),
            key    = 'event:' + yuid + type + '_synth',
            events = DOMMap[yuid];

        if (create) {
            if (!events) {
                events = DOMMap[yuid] = {};
            }
            if (!events[key]) {
                events[key] = new SynthRegistry(el, yuid, key);
            }
        }

        return (events && events[key]) || null;
    },

    /**
     * Alternate <code>_delete()</code> method for the CustomEvent object
     * created to manage SyntheticEvent subscriptions.
     *
     * @method _deleteSub
     * @param sub {Subscription} the subscription to clean up
     * @private
     * @since 3.2.0
     */
    _deleteSub: function (sub) {
        if (sub && sub.fn) {
            var synth = this.eventDef,
                method = (sub.filter) ? 'detachDelegate' : 'detach';

            this._subscribers = [];

            if (CustomEvent.keepDeprecatedSubs) {
                this.subscribers = {};
            }

            synth[method](sub.node, sub, this.notifier, sub.filter);
            this.registry.unregister(sub);

            delete sub.fn;
            delete sub.node;
            delete sub.context;
        }
    },

    prototype: {
        constructor: SyntheticEvent,

        /**
         * Construction logic for the event.
         *
         * @method _init
         * @protected
         */
        _init: function () {
            var config = this.publishConfig || (this.publishConfig = {});

            // The notification mechanism handles facade creation
            this.emitFacade = ('emitFacade' in config) ?
                                config.emitFacade :
                                true;
            config.emitFacade  = false;
        },

        /**
         * <p>Implementers MAY provide this method definition.</p>
         *
         * <p>Implement this function if the event supports a different
         * subscription signature.  This function is used by both
         * <code>on()</code> and <code>delegate()</code>.  The second parameter
         * indicates that the event is being subscribed via
         * <code>delegate()</code>.</p>
         *
         * <p>Implementations must remove extra arguments from the args list
         * before returning.  The required args for <code>on()</code>
         * subscriptions are</p>
         * <pre><code>[type, callback, target, context, argN...]</code></pre>
         *
         * <p>The required args for <code>delegate()</code>
         * subscriptions are</p>
         *
         * <pre><code>[type, callback, target, filter, context, argN...]</code></pre>
         *
         * <p>The return value from this function will be stored on the
         * subscription in the '_extra' property for reference elsewhere.</p>
         *
         * @method processArgs
         * @param args {Array} parmeters passed to Y.on(..) or Y.delegate(..)
         * @param delegate {Boolean} true if the subscription is from Y.delegate
         * @return {any}
         */
        processArgs: noop,

        /**
         * <p>Implementers MAY override this property.</p>
         *
         * <p>Whether to prevent multiple subscriptions to this event that are
         * classified as being the same.  By default, this means the subscribed
         * callback is the same function.  See the <code>subMatch</code>
         * method.  Setting this to true will impact performance for high volume
         * events.</p>
         *
         * @property preventDups
         * @type {Boolean}
         * @default false
         */
        //preventDups  : false,

        /**
         * <p>Implementers SHOULD provide this method definition.</p>
         *
         * Implementation logic for subscriptions done via <code>node.on(type,
         * fn)</code> or <code>Y.on(type, fn, target)</code>.  This
         * function should set up the monitor(s) that will eventually fire the
         * event.  Typically this involves subscribing to at least one DOM
         * event.  It is recommended to store detach handles from any DOM
         * subscriptions to make for easy cleanup in the <code>detach</code>
         * method.  Typically these handles are added to the <code>sub</code>
         * object.  Also for SyntheticEvents that leverage a single DOM
         * subscription under the hood, it is recommended to pass the DOM event
         * object to <code>notifier.fire(e)</code>.  (The event name on the
         * object will be updated).
         *
         * @method on
         * @param node {Node} the node the subscription is being applied to
         * @param sub {Subscription} the object to track this subscription
         * @param notifier {SyntheticEvent.Notifier} call notifier.fire(..) to
         *              trigger the execution of the subscribers
         */
        on: noop,

        /**
         * <p>Implementers SHOULD provide this method definition.</p>
         *
         * <p>Implementation logic for detaching subscriptions done via
         * <code>node.on(type, fn)</code>.  This function should clean up any
         * subscriptions made in the <code>on()</code> phase.</p>
         *
         * @method detach
         * @param node {Node} the node the subscription was applied to
         * @param sub {Subscription} the object tracking this subscription
         * @param notifier {SyntheticEvent.Notifier} the Notifier used to
         *              trigger the execution of the subscribers
         */
        detach: noop,

        /**
         * <p>Implementers SHOULD provide this method definition.</p>
         *
         * <p>Implementation logic for subscriptions done via
         * <code>node.delegate(type, fn, filter)</code> or
         * <code>Y.delegate(type, fn, container, filter)</code>.  Like with
         * <code>on()</code> above, this function should monitor the environment
         * for the event being fired, and trigger subscription execution by
         * calling <code>notifier.fire(e)</code>.</p>
         *
         * <p>This function receives a fourth argument, which is the filter
         * used to identify which Node's are of interest to the subscription.
         * The filter will be either a boolean function that accepts a target
         * Node for each hierarchy level as the event bubbles, or a selector
         * string.  To translate selector strings into filter functions, use
         * <code>Y.delegate.compileFilter(filter)</code>.</p>
         *
         * @method delegate
         * @param node {Node} the node the subscription is being applied to
         * @param sub {Subscription} the object to track this subscription
         * @param notifier {SyntheticEvent.Notifier} call notifier.fire(..) to
         *              trigger the execution of the subscribers
         * @param filter {String|Function} Selector string or function that
         *              accepts an event object and returns null, a Node, or an
         *              array of Nodes matching the criteria for processing.
         * @since 3.2.0
         */
        delegate       : noop,

        /**
         * <p>Implementers SHOULD provide this method definition.</p>
         *
         * <p>Implementation logic for detaching subscriptions done via
         * <code>node.delegate(type, fn, filter)</code> or
         * <code>Y.delegate(type, fn, container, filter)</code>.  This function
         * should clean up any subscriptions made in the
         * <code>delegate()</code> phase.</p>
         *
         * @method detachDelegate
         * @param node {Node} the node the subscription was applied to
         * @param sub {Subscription} the object tracking this subscription
         * @param notifier {SyntheticEvent.Notifier} the Notifier used to
         *              trigger the execution of the subscribers
         * @param filter {String|Function} Selector string or function that
         *              accepts an event object and returns null, a Node, or an
         *              array of Nodes matching the criteria for processing.
         * @since 3.2.0
         */
        detachDelegate : noop,

        /**
         * Sets up the boilerplate for detaching the event and facilitating the
         * execution of subscriber callbacks.
         *
         * @method _on
         * @param args {Array} array of arguments passed to
         *              <code>Y.on(...)</code> or <code>Y.delegate(...)</code>
         * @param delegate {Boolean} true if called from
         * <code>Y.delegate(...)</code>
         * @return {EventHandle} the detach handle for this subscription
         * @private
         * since 3.2.0
         */
        _on: function (args, delegate) {
            var handles  = [],
                originalArgs = args.slice(),
                extra    = this.processArgs(args, delegate),
                selector = args[2],
                method   = delegate ? 'delegate' : 'on',
                nodes, handle;

            // Can't just use Y.all because it doesn't support window (yet?)
            nodes = (isString(selector)) ?
                query(selector) :
                toArray(selector || Y.one(Y.config.win));

            if (!nodes.length && isString(selector)) {
                handle = Y.on('available', function () {
                    Y.mix(handle, Y[method].apply(Y, originalArgs), true);
                }, selector);

                return handle;
            }

            Y.Array.each(nodes, function (node) {
                var subArgs = args.slice(),
                    filter;

                node = Y.one(node);

                if (node) {
                    if (delegate) {
                        filter = subArgs.splice(3, 1)[0];
                    }

                    // (type, fn, el, thisObj, ...) => (fn, thisObj, ...)
                    subArgs.splice(0, 4, subArgs[1], subArgs[3]);

                    if (!this.preventDups ||
                        !this.getSubs(node, args, null, true))
                    {
                        handles.push(this._subscribe(node, method, subArgs, extra, filter));
                    }
                }
            }, this);

            return (handles.length === 1) ?
                handles[0] :
                new Y.EventHandle(handles);
        },

        /**
         * Creates a new Notifier object for use by this event's
         * <code>on(...)</code> or <code>delegate(...)</code> implementation
         * and register the custom event proxy in the DOM system for cleanup.
         *
         * @method _subscribe
         * @param node {Node} the Node hosting the event
         * @param method {String} "on" or "delegate"
         * @param args {Array} the subscription arguments passed to either
         *              <code>Y.on(...)</code> or <code>Y.delegate(...)</code>
         *              after running through <code>processArgs(args)</code> to
         *              normalize the argument signature
         * @param extra {any} Extra data parsed from
         *              <code>processArgs(args)</code>
         * @param filter {String|Function} the selector string or function
         *              filter passed to <code>Y.delegate(...)</code> (not
         *              present when called from <code>Y.on(...)</code>)
         * @return {EventHandle}
         * @private
         * @since 3.2.0
         */
        _subscribe: function (node, method, args, extra, filter) {
            var dispatcher = new Y.CustomEvent(this.type, this.publishConfig),
                handle     = dispatcher.on.apply(dispatcher, args),
                notifier   = new Notifier(handle, this.emitFacade),
                registry   = SyntheticEvent.getRegistry(node, this.type, true),
                sub        = handle.sub;

            sub.node   = node;
            sub.filter = filter;
            if (extra) {
                this.applyArgExtras(extra, sub);
            }

            Y.mix(dispatcher, {
                eventDef     : this,
                notifier     : notifier,
                host         : node,       // I forget what this is for
                currentTarget: node,       // for generating facades
                target       : node,       // for generating facades
                el           : node._node, // For category detach

                _delete      : SyntheticEvent._deleteSub
            }, true);

            handle.notifier = notifier;

            registry.register(handle);

            // Call the implementation's "on" or "delegate" method
            this[method](node, sub, notifier, filter);

            return handle;
        },

        /**
         * <p>Implementers MAY provide this method definition.</p>
         *
         * <p>Implement this function if you want extra data extracted during
         * processArgs to be propagated to subscriptions on a per-node basis.
         * That is to say, if you call <code>Y.on('xyz', fn, xtra, 'div')</code>
         * the data returned from processArgs will be shared
         * across the subscription objects for all the divs.  If you want each
         * subscription to receive unique information, do that processing
         * here.</p>
         *
         * <p>The default implementation adds the data extracted by processArgs
         * to the subscription object as <code>sub._extra</code>.</p>
         *
         * @method applyArgExtras
         * @param extra {any} Any extra data extracted from processArgs
         * @param sub {Subscription} the individual subscription
         */
        applyArgExtras: function (extra, sub) {
            sub._extra = extra;
        },

        /**
         * Removes the subscription(s) from the internal subscription dispatch
         * mechanism.  See <code>SyntheticEvent._deleteSub</code>.
         *
         * @method _detach
         * @param args {Array} The arguments passed to
         *                  <code>node.detach(...)</code>
         * @private
         * @since 3.2.0
         */
        _detach: function (args) {
            // Can't use Y.all because it doesn't support window (yet?)
            // TODO: Does Y.all support window now?
            var target = args[2],
                els    = (isString(target)) ?
                            query(target) : toArray(target),
                node, i, len, handles, j;

            // (type, fn, el, context, filter?) => (type, fn, context, filter?)
            args.splice(2, 1);

            for (i = 0, len = els.length; i < len; ++i) {
                node = Y.one(els[i]);

                if (node) {
                    handles = this.getSubs(node, args);

                    if (handles) {
                        for (j = handles.length - 1; j >= 0; --j) {
                            handles[j].detach();
                        }
                    }
                }
            }
        },

        /**
         * Returns the detach handles of subscriptions on a node that satisfy a
         * search/filter function.  By default, the filter used is the
         * <code>subMatch</code> method.
         *
         * @method getSubs
         * @param node {Node} the node hosting the event
         * @param args {Array} the array of original subscription args passed
         *              to <code>Y.on(...)</code> (before
         *              <code>processArgs</code>
         * @param filter {Function} function used to identify a subscription
         *              for inclusion in the returned array
         * @param first {Boolean} stop after the first match (used to check for
         *              duplicate subscriptions)
         * @return {EventHandle[]} detach handles for the matching subscriptions
         */
        getSubs: function (node, args, filter, first) {
            var registry = SyntheticEvent.getRegistry(node, this.type),
                handles  = [],
                allHandles, i, len, handle;

            if (registry) {
                allHandles = registry.handles;

                if (!filter) {
                    filter = this.subMatch;
                }

                for (i = 0, len = allHandles.length; i < len; ++i) {
                    handle = allHandles[i];
                    if (filter.call(this, handle.sub, args)) {
                        if (first) {
                            return handle;
                        } else {
                            handles.push(allHandles[i]);
                        }
                    }
                }
            }

            return handles.length && handles;
        },

        /**
         * <p>Implementers MAY override this to define what constitutes a
         * &quot;same&quot; subscription.  Override implementations should
         * consider the lack of a comparator as a match, so calling
         * <code>getSubs()</code> with no arguments will return all subs.</p>
         *
         * <p>Compares a set of subscription arguments against a Subscription
         * object to determine if they match.  The default implementation
         * compares the callback function against the second argument passed to
         * <code>Y.on(...)</code> or <code>node.detach(...)</code> etc.</p>
         *
         * @method subMatch
         * @param sub {Subscription} the existing subscription
         * @param args {Array} the calling arguments passed to
         *                  <code>Y.on(...)</code> etc.
         * @return {Boolean} true if the sub can be described by the args
         *                  present
         * @since 3.2.0
         */
        subMatch: function (sub, args) {
            // Default detach cares only about the callback matching
            return !args[1] || sub.fn === args[1];
        }
    }
}, true);

Y.SyntheticEvent = SyntheticEvent;

/**
 * <p>Defines a new event in the DOM event system.  Implementers are
 * responsible for monitoring for a scenario whereby the event is fired.  A
 * notifier object is provided to the functions identified below.  When the
 * criteria defining the event are met, call notifier.fire( [args] ); to
 * execute event subscribers.</p>
 *
 * <p>The first parameter is the name of the event.  The second parameter is a
 * configuration object which define the behavior of the event system when the
 * new event is subscribed to or detached from.  The methods that should be
 * defined in this configuration object are <code>on</code>,
 * <code>detach</code>, <code>delegate</code>, and <code>detachDelegate</code>.
 * You are free to define any other methods or properties needed to define your
 * event.  Be aware, however, that since the object is used to subclass
 * SyntheticEvent, you should avoid method names used by SyntheticEvent unless
 * your intention is to override the default behavior.</p>
 *
 * <p>This is a list of properties and methods that you can or should specify
 * in the configuration object:</p>
 *
 * <dl>
 *   <dt><code>on</code></dt>
 *       <dd><code>function (node, subscription, notifier)</code> The
 *       implementation logic for subscription.  Any special setup you need to
 *       do to create the environment for the event being fired--E.g. native
 *       DOM event subscriptions.  Store subscription related objects and
 *       state on the <code>subscription</code> object.  When the
 *       criteria have been met to fire the synthetic event, call
 *       <code>notifier.fire(e)</code>.  See Notifier's <code>fire()</code>
 *       method for details about what to pass as parameters.</dd>
 *
 *   <dt><code>detach</code></dt>
 *       <dd><code>function (node, subscription, notifier)</code> The
 *       implementation logic for cleaning up a detached subscription. E.g.
 *       detach any DOM subscriptions added in <code>on</code>.</dd>
 *
 *   <dt><code>delegate</code></dt>
 *       <dd><code>function (node, subscription, notifier, filter)</code> The
 *       implementation logic for subscription via <code>Y.delegate</code> or
 *       <code>node.delegate</code>.  The filter is typically either a selector
 *       string or a function.  You can use
 *       <code>Y.delegate.compileFilter(selectorString)</code> to create a
 *       filter function from a selector string if needed.  The filter function
 *       expects an event object as input and should output either null, a
 *       matching Node, or an array of matching Nodes.  Otherwise, this acts
 *       like <code>on</code> DOM event subscriptions.  Store subscription
 *       related objects and information on the <code>subscription</code>
 *       object.  When the criteria have been met to fire the synthetic event,
 *       call <code>notifier.fire(e)</code> as noted above.</dd>
 *
 *   <dt><code>detachDelegate</code></dt>
 *       <dd><code>function (node, subscription, notifier)</code> The
 *       implementation logic for cleaning up a detached delegate subscription.
 *       E.g. detach any DOM delegate subscriptions added in
 *       <code>delegate</code>.</dd>
 *
 *   <dt><code>publishConfig</code></dt>
 *       <dd>(Object) The configuration object that will be used to instantiate
 *       the underlying CustomEvent. See Notifier's <code>fire</code> method
 *       for details.</dd>
 *
 *   <dt><code>processArgs</code></dt
 *       <dd>
 *          <p><code>function (argArray, fromDelegate)</code> Optional method
 *          to extract any additional arguments from the subscription
 *          signature.  Using this allows <code>on</code> or
 *          <code>delegate</code> signatures like
 *          <code>node.on(&quot;hover&quot;, overCallback,
 *          outCallback)</code>.</p>
 *          <p>When processing an atypical argument signature, make sure the
 *          args array is returned to the normal signature before returning
 *          from the function.  For example, in the &quot;hover&quot; example
 *          above, the <code>outCallback</code> needs to be <code>splice</code>d
 *          out of the array.  The expected signature of the args array for
 *          <code>on()</code> subscriptions is:</p>
 *          <pre>
 *              <code>[type, callback, target, contextOverride, argN...]</code>
 *          </pre>
 *          <p>And for <code>delegate()</code>:</p>
 *          <pre>
 *              <code>[type, callback, target, filter, contextOverride, argN...]</code>
 *          </pre>
 *          <p>where <code>target</code> is the node the event is being
 *          subscribed for.  You can see these signatures documented for
 *          <code>Y.on()</code> and <code>Y.delegate()</code> respectively.</p>
 *          <p>Whatever gets returned from the function will be stored on the
 *          <code>subscription</code> object under
 *          <code>subscription._extra</code>.</p></dd>
 *   <dt><code>subMatch</code></dt>
 *       <dd>
 *           <p><code>function (sub, args)</code>  Compares a set of
 *           subscription arguments against a Subscription object to determine
 *           if they match.  The default implementation compares the callback
 *           function against the second argument passed to
 *           <code>Y.on(...)</code> or <code>node.detach(...)</code> etc.</p>
 *       </dd>
 * </dl>
 *
 * @method define
 * @param type {String} the name of the event
 * @param config {Object} the prototype definition for the new event (see above)
 * @param force {Boolean} override an existing event (use with caution)
 * @return {SyntheticEvent} the subclass implementation instance created to
 *              handle event subscriptions of this type
 * @static
 * @for Event
 * @since 3.1.0
 * @in event-synthetic
 */
Y.Event.define = function (type, config, force) {
    var eventDef, Impl, synth;

    if (type && type.type) {
        eventDef = type;
        force = config;
    } else if (config) {
        eventDef = Y.merge({ type: type }, config);
    }

    if (eventDef) {
        if (force || !Y.Node.DOM_EVENTS[eventDef.type]) {
            Impl = function () {
                SyntheticEvent.apply(this, arguments);
            };
            Y.extend(Impl, SyntheticEvent, eventDef);
            synth = new Impl();

            type = synth.type;

            Y.Node.DOM_EVENTS[type] = Y.Env.evt.plugins[type] = {
                eventDef: synth,

                on: function () {
                    return synth._on(toArray(arguments));
                },

                delegate: function () {
                    return synth._on(toArray(arguments), true);
                },

                detach: function () {
                    return synth._detach(toArray(arguments));
                }
            };

        }
    } else if (isString(type) || isArray(type)) {
        Y.Array.each(toArray(type), function (t) {
            Y.Node.DOM_EVENTS[t] = 1;
        });
    }

    return synth;
};


}, '3.17.1', {"requires": ["node-base", "event-custom-complex"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-mousewheel', function (Y, NAME) {

/**
 * Adds mousewheel event support
 * @module event
 * @submodule event-mousewheel
 */
var DOM_MOUSE_SCROLL = 'DOMMouseScroll',
    fixArgs = function(args) {
        var a = Y.Array(args, 0, true), target;
        if (Y.UA.gecko) {
            a[0] = DOM_MOUSE_SCROLL;
            target = Y.config.win;
        } else {
            target = Y.config.doc;
        }

        if (a.length < 3) {
            a[2] = target;
        } else {
            a.splice(2, 0, target);
        }

        return a;
    };

/**
 * Mousewheel event.  This listener is automatically attached to the
 * correct target, so one should not be supplied.  Mouse wheel
 * direction and velocity is stored in the 'wheelDelta' field.
 * @event mousewheel
 * @param type {string} 'mousewheel'
 * @param fn {function} the callback to execute
 * @param context optional context object
 * @param args 0..n additional arguments to provide to the listener.
 * @return {EventHandle} the detach handle
 * @for YUI
 */
Y.Env.evt.plugins.mousewheel = {
    on: function() {
        return Y.Event._attach(fixArgs(arguments));
    },

    detach: function() {
        return Y.Event.detach.apply(Y.Event, fixArgs(arguments));
    }
};


}, '3.17.1', {"requires": ["node-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-mouseenter', function (Y, NAME) {

/**
 * <p>Adds subscription and delegation support for mouseenter and mouseleave
 * events.  Unlike mouseover and mouseout, these events aren't fired from child
 * elements of a subscribed node.</p>
 *
 * <p>This avoids receiving three mouseover notifications from a setup like</p>
 *
 * <pre><code>div#container > p > a[href]</code></pre>
 *
 * <p>where</p>
 *
 * <pre><code>Y.one('#container').on('mouseover', callback)</code></pre>
 *
 * <p>When the mouse moves over the link, one mouseover event is fired from
 * #container, then when the mouse moves over the p, another mouseover event is
 * fired and bubbles to #container, causing a second notification, and finally
 * when the mouse moves over the link, a third mouseover event is fired and
 * bubbles to #container for a third notification.</p>
 *
 * <p>By contrast, using mouseenter instead of mouseover, the callback would be
 * executed only once when the mouse moves over #container.</p>
 *
 * @module event
 * @submodule event-mouseenter
 */

var domEventProxies = Y.Env.evt.dom_wrappers,
    contains = Y.DOM.contains,
    toArray = Y.Array,
    noop = function () {},

    config = {
        proxyType: "mouseover",
        relProperty: "fromElement",

        _notify: function (e, property, notifier) {
            var el = this._node,
                related = e.relatedTarget || e[property];

            if (el !== related && !contains(el, related)) {
                notifier.fire(new Y.DOMEventFacade(e, el,
                    domEventProxies['event:' + Y.stamp(el) + e.type]));
            }
        },

        on: function (node, sub, notifier) {
            var el = Y.Node.getDOMNode(node),
                args = [
                    this.proxyType,
                    this._notify,
                    el,
                    null,
                    this.relProperty,
                    notifier];

            sub.handle = Y.Event._attach(args, { facade: false });
            // node.on(this.proxyType, notify, null, notifier);
        },

        detach: function (node, sub) {
            sub.handle.detach();
        },

        delegate: function (node, sub, notifier, filter) {
            var el = Y.Node.getDOMNode(node),
                args = [
                    this.proxyType,
                    noop,
                    el,
                    null,
                    notifier
                ];

            sub.handle = Y.Event._attach(args, { facade: false });
            sub.handle.sub.filter = filter;
            sub.handle.sub.relProperty = this.relProperty;
            sub.handle.sub._notify = this._filterNotify;
        },

        _filterNotify: function (thisObj, args, ce) {
            args = args.slice();
            if (this.args) {
                args.push.apply(args, this.args);
            }

            var currentTarget = Y.delegate._applyFilter(this.filter, args, ce),
                related = args[0].relatedTarget || args[0][this.relProperty],
                e, i, len, ret, ct;

            if (currentTarget) {
                currentTarget = toArray(currentTarget);

                for (i = 0, len = currentTarget.length && (!e || !e.stopped); i < len; ++i) {
                    ct = currentTarget[0];
                    if (!contains(ct, related)) {
                        if (!e) {
                            e = new Y.DOMEventFacade(args[0], ct, ce);
                            e.container = Y.one(ce.el);
                        }
                        e.currentTarget = Y.one(ct);

                        // TODO: where is notifier? args? this.notifier?
                        ret = args[1].fire(e);

                        if (ret === false) {
                            break;
                        }
                    }
                }
            }

            return ret;
        },

        detachDelegate: function (node, sub) {
            sub.handle.detach();
        }
    };

Y.Event.define("mouseenter", config, true);
Y.Event.define("mouseleave", Y.merge(config, {
    proxyType: "mouseout",
    relProperty: "toElement"
}), true);


}, '3.17.1', {"requires": ["event-synthetic"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-key', function (Y, NAME) {

/**
 * Functionality to listen for one or more specific key combinations.
 * @module event
 * @submodule event-key
 */

var ALT      = "+alt",
    CTRL     = "+ctrl",
    META     = "+meta",
    SHIFT    = "+shift",

    trim     = Y.Lang.trim,

    eventDef = {
        KEY_MAP: {
            enter    : 13,
            space    : 32,
            esc      : 27,
            backspace: 8,
            tab      : 9,
            pageup   : 33,
            pagedown : 34
        },

        _typeRE: /^(up|down|press):/,
        _keysRE: /^(?:up|down|press):|\+(alt|ctrl|meta|shift)/g,

        processArgs: function (args) {
            var spec = args.splice(3,1)[0],
                mods = Y.Array.hash(spec.match(/\+(?:alt|ctrl|meta|shift)\b/g) || []),
                config = {
                    type: this._typeRE.test(spec) ? RegExp.$1 : null,
                    mods: mods,
                    keys: null
                },
                // strip type and modifiers from spec, leaving only keyCodes
                bits = spec.replace(this._keysRE, ''),
                chr, uc, lc, i;

            if (bits) {
                bits = bits.split(',');

                config.keys = {};

                // FIXME: need to support '65,esc' => keypress, keydown
                for (i = bits.length - 1; i >= 0; --i) {
                    chr = trim(bits[i]);

                    // catch sloppy filters, trailing commas, etc 'a,,'
                    if (!chr) {
                        continue;
                    }

                    // non-numerics are single characters or key names
                    if (+chr == chr) {
                        config.keys[chr] = mods;
                    } else {
                        lc = chr.toLowerCase();

                        if (this.KEY_MAP[lc]) {
                            config.keys[this.KEY_MAP[lc]] = mods;
                            // FIXME: '65,enter' defaults keydown for both
                            if (!config.type) {
                                config.type = "down"; // safest
                            }
                        } else {
                            // FIXME: Character mapping only works for keypress
                            // events. Otherwise, it uses String.fromCharCode()
                            // from the keyCode, which is wrong.
                            chr = chr.charAt(0);
                            uc  = chr.toUpperCase();

                            if (mods["+shift"]) {
                                chr = uc;
                            }

                            // FIXME: stupid assumption that
                            // the keycode of the lower case == the
                            // charCode of the upper case
                            // a (key:65,char:97), A (key:65,char:65)
                            config.keys[chr.charCodeAt(0)] =
                                (chr === uc) ?
                                    // upper case chars get +shift free
                                    Y.merge(mods, { "+shift": true }) :
                                    mods;
                        }
                    }
                }
            }

            if (!config.type) {
                config.type = "press";
            }

            return config;
        },

        on: function (node, sub, notifier, filter) {
            var spec   = sub._extra,
                type   = "key" + spec.type,
                keys   = spec.keys,
                method = (filter) ? "delegate" : "on";

            // Note: without specifying any keyCodes, this becomes a
            // horribly inefficient alias for 'keydown' (et al), but I
            // can't abort this subscription for a simple
            // Y.on('keypress', ...);
            // Please use keyCodes or just subscribe directly to keydown,
            // keyup, or keypress
            sub._detach = node[method](type, function (e) {
                var key = keys ? keys[e.which] : spec.mods;

                if (key &&
                    (!key[ALT]   || (key[ALT]   && e.altKey)) &&
                    (!key[CTRL]  || (key[CTRL]  && e.ctrlKey)) &&
                    (!key[META]  || (key[META]  && e.metaKey)) &&
                    (!key[SHIFT] || (key[SHIFT] && e.shiftKey)))
                {
                    notifier.fire(e);
                }
            }, filter);
        },

        detach: function (node, sub, notifier) {
            sub._detach.detach();
        }
    };

eventDef.delegate = eventDef.on;
eventDef.detachDelegate = eventDef.detach;

/**
 * <p>Add a key listener.  The listener will only be notified if the
 * keystroke detected meets the supplied specification.  The
 * specification is a string that is defined as:</p>
 *
 * <dl>
 *   <dt>spec</dt>
 *   <dd><code>[{type}:]{code}[,{code}]*</code></dd>
 *   <dt>type</dt>
 *   <dd><code>"down", "up", or "press"</code></dd>
 *   <dt>code</dt>
 *   <dd><code>{keyCode|character|keyName}[+{modifier}]*</code></dd>
 *   <dt>modifier</dt>
 *   <dd><code>"shift", "ctrl", "alt", or "meta"</code></dd>
 *   <dt>keyName</dt>
 *   <dd><code>"enter", "space", "backspace", "esc", "tab", "pageup", or "pagedown"</code></dd>
 * </dl>
 *
 * <p>Examples:</p>
 * <ul>
 *   <li><code>Y.on("key", callback, "press:12,65+shift+ctrl", "#my-input");</code></li>
 *   <li><code>Y.delegate("key", preventSubmit, "#forms", "enter", "input[type=text]");</code></li>
 *   <li><code>Y.one("doc").on("key", viNav, "j,k,l,;");</code></li>
 * </ul>
 *
 * @event key
 * @for YUI
 * @param type {string} 'key'
 * @param fn {function} the function to execute
 * @param id {string|HTMLElement|collection} the element(s) to bind
 * @param spec {string} the keyCode and modifier specification
 * @param o optional context object
 * @param args 0..n additional arguments to provide to the listener.
 * @return {Event.Handle} the detach handle
 */
Y.Event.define('key', eventDef, true);


}, '3.17.1', {"requires": ["event-synthetic"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-focus', function (Y, NAME) {

/**
 * Adds bubbling and delegation support to DOM events focus and blur.
 *
 * @module event
 * @submodule event-focus
 */
var Event    = Y.Event,

    YLang    = Y.Lang,

    isString = YLang.isString,

    arrayIndex = Y.Array.indexOf,

    useActivate = (function() {

        // Changing the structure of this test, so that it doesn't use inline JS in HTML,
        // which throws an exception in Win8 packaged apps, due to additional security restrictions:
        // http://msdn.microsoft.com/en-us/library/windows/apps/hh465380.aspx#differences

        var supported = false,
            doc = Y.config.doc,
            p;

        if (doc) {

            p = doc.createElement("p");
            p.setAttribute("onbeforeactivate", ";");

            // onbeforeactivate is a function in IE8+.
            // onbeforeactivate is a string in IE6,7 (unfortunate, otherwise we could have just checked for function below).
            // onbeforeactivate is a function in IE10, in a Win8 App environment (no exception running the test).

            // onbeforeactivate is undefined in Webkit/Gecko.
            // onbeforeactivate is a function in Webkit/Gecko if it's a supported event (e.g. onclick).

            supported = (p.onbeforeactivate !== undefined);
        }

        return supported;
    }());

function define(type, proxy, directEvent) {
    var nodeDataKey = '_' + type + 'Notifiers';

    Y.Event.define(type, {

        _useActivate : useActivate,

        _attach: function (el, notifier, delegate) {
            if (Y.DOM.isWindow(el)) {
                return Event._attach([type, function (e) {
                    notifier.fire(e);
                }, el]);
            } else {
                return Event._attach(
                    [proxy, this._proxy, el, this, notifier, delegate],
                    { capture: true });
            }
        },

        _proxy: function (e, notifier, delegate) {
            var target        = e.target,
                currentTarget = e.currentTarget,
                notifiers     = target.getData(nodeDataKey),
                yuid          = Y.stamp(currentTarget._node),
                defer         = (useActivate || target !== currentTarget),
                directSub;

            notifier.currentTarget = (delegate) ? target : currentTarget;
            notifier.container     = (delegate) ? currentTarget : null;

            // Maintain a list to handle subscriptions from nested
            // containers div#a>div#b>input #a.on(focus..) #b.on(focus..),
            // use one focus or blur subscription that fires notifiers from
            // #b then #a to emulate bubble sequence.
            if (!notifiers) {
                notifiers = {};
                target.setData(nodeDataKey, notifiers);

                // only subscribe to the element's focus if the target is
                // not the current target (
                if (defer) {
                    directSub = Event._attach(
                        [directEvent, this._notify, target._node]).sub;
                    directSub.once = true;
                }
            } else {
                // In old IE, defer is always true.  In capture-phase browsers,
                // The delegate subscriptions will be encountered first, which
                // will establish the notifiers data and direct subscription
                // on the node.  If there is also a direct subscription to the
                // node's focus/blur, it should not call _notify because the
                // direct subscription from the delegate sub(s) exists, which
                // will call _notify.  So this avoids _notify being called
                // twice, unnecessarily.
                defer = true;
            }

            if (!notifiers[yuid]) {
                notifiers[yuid] = [];
            }

            notifiers[yuid].push(notifier);

            if (!defer) {
                this._notify(e);
            }
        },

        _notify: function (e, container) {
            var currentTarget = e.currentTarget,
                notifierData  = currentTarget.getData(nodeDataKey),
                axisNodes     = currentTarget.ancestors(),
                doc           = currentTarget.get('ownerDocument'),
                delegates     = [],
                                // Used to escape loops when there are no more
                                // notifiers to consider
                count         = notifierData ?
                                    Y.Object.keys(notifierData).length :
                                    0,
                target, notifiers, notifier, yuid, match, tmp, i, len, sub, ret;

            // clear the notifications list (mainly for delegation)
            currentTarget.clearData(nodeDataKey);

            // Order the delegate subs by their placement in the parent axis
            axisNodes.push(currentTarget);
            // document.get('ownerDocument') returns null
            // which we'll use to prevent having duplicate Nodes in the list
            if (doc) {
                axisNodes.unshift(doc);
            }

            // ancestors() returns the Nodes from top to bottom
            axisNodes._nodes.reverse();

            if (count) {
                // Store the count for step 2
                tmp = count;
                axisNodes.some(function (node) {
                    var yuid      = Y.stamp(node),
                        notifiers = notifierData[yuid],
                        i, len;

                    if (notifiers) {
                        count--;
                        for (i = 0, len = notifiers.length; i < len; ++i) {
                            if (notifiers[i].handle.sub.filter) {
                                delegates.push(notifiers[i]);
                            }
                        }
                    }

                    return !count;
                });
                count = tmp;
            }

            // Walk up the parent axis, notifying direct subscriptions and
            // testing delegate filters.
            while (count && (target = axisNodes.shift())) {
                yuid = Y.stamp(target);

                notifiers = notifierData[yuid];

                if (notifiers) {
                    for (i = 0, len = notifiers.length; i < len; ++i) {
                        notifier = notifiers[i];
                        sub      = notifier.handle.sub;
                        match    = true;

                        e.currentTarget = target;

                        if (sub.filter) {
                            match = sub.filter.apply(target,
                                [target, e].concat(sub.args || []));

                            // No longer necessary to test against this
                            // delegate subscription for the nodes along
                            // the parent axis.
                            delegates.splice(
                                arrayIndex(delegates, notifier), 1);
                        }

                        if (match) {
                            // undefined for direct subs
                            e.container = notifier.container;
                            ret = notifier.fire(e);
                        }

                        if (ret === false || e.stopped === 2) {
                            break;
                        }
                    }

                    delete notifiers[yuid];
                    count--;
                }

                if (e.stopped !== 2) {
                    // delegates come after subs targeting this specific node
                    // because they would not normally report until they'd
                    // bubbled to the container node.
                    for (i = 0, len = delegates.length; i < len; ++i) {
                        notifier = delegates[i];
                        sub = notifier.handle.sub;

                        if (sub.filter.apply(target,
                            [target, e].concat(sub.args || []))) {

                            e.container = notifier.container;
                            e.currentTarget = target;
                            ret = notifier.fire(e);
                        }

                        if (ret === false || e.stopped === 2 ||
                            // If e.stopPropagation() is called, notify any
                            // delegate subs from the same container, but break
                            // once the container changes. This emulates
                            // delegate() behavior for events like 'click' which
                            // won't notify delegates higher up the parent axis.
                            (e.stopped && delegates[i+1] &&
                             delegates[i+1].container !== notifier.container)) {
                            break;
                        }
                    }
                }

                if (e.stopped) {
                    break;
                }
            }
        },

        on: function (node, sub, notifier) {
            sub.handle = this._attach(node._node, notifier);
        },

        detach: function (node, sub) {
            sub.handle.detach();
        },

        delegate: function (node, sub, notifier, filter) {
            if (isString(filter)) {
                sub.filter = function (target) {
                    return Y.Selector.test(target._node, filter,
                        node === target ? null : node._node);
                };
            }

            sub.handle = this._attach(node._node, notifier, true);
        },

        detachDelegate: function (node, sub) {
            sub.handle.detach();
        }
    }, true);
}

// For IE, we need to defer to focusin rather than focus because
// `el.focus(); doSomething();` executes el.onbeforeactivate, el.onactivate,
// el.onfocusin, doSomething, then el.onfocus.  All others support capture
// phase focus, which executes before doSomething.  To guarantee consistent
// behavior for this use case, IE's direct subscriptions are made against
// focusin so subscribers will be notified before js following el.focus() is
// executed.
if (useActivate) {
    //     name     capture phase       direct subscription
    define("focus", "beforeactivate",   "focusin");
    define("blur",  "beforedeactivate", "focusout");
} else {
    define("focus", "focus", "focus");
    define("blur",  "blur",  "blur");
}


}, '3.17.1', {"requires": ["event-synthetic"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-resize', function (Y, NAME) {

/**
 * Adds a window resize event that has its behavior normalized to fire at the
 * end of the resize rather than constantly during the resize.
 * @module event
 * @submodule event-resize
 */


/**
 * Old firefox fires the window resize event once when the resize action
 * finishes, other browsers fire the event periodically during the
 * resize.  This code uses timeout logic to simulate the Firefox
 * behavior in other browsers.
 * @event windowresize
 * @for YUI
 */
Y.Event.define('windowresize', {

    on: (Y.UA.gecko && Y.UA.gecko < 1.91) ?
        function (node, sub, notifier) {
            sub._handle = Y.Event.attach('resize', function (e) {
                notifier.fire(e);
            });
        } :
        function (node, sub, notifier) {
            // interval bumped from 40 to 100ms as of 3.4.1
            var delay = Y.config.windowResizeDelay || 100;

            sub._handle = Y.Event.attach('resize', function (e) {
                if (sub._timer) {
                    sub._timer.cancel();
                }

                sub._timer = Y.later(delay, Y, function () {
                    notifier.fire(e);
                });
            });
        },

    detach: function (node, sub) {
        if (sub._timer) {
            sub._timer.cancel();
        }
        sub._handle.detach();
    }
    // delegate methods not defined because this only works for window
    // subscriptions, so...yeah.
});


}, '3.17.1', {"requires": ["node-base", "event-synthetic"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-hover', function (Y, NAME) {

/**
 * Adds support for a "hover" event.  The event provides a convenience wrapper
 * for subscribing separately to mouseenter and mouseleave.  The signature for
 * subscribing to the event is</p>
 *
 * <pre><code>node.on("hover", overFn, outFn);
 * node.delegate("hover", overFn, outFn, ".filterSelector");
 * Y.on("hover", overFn, outFn, ".targetSelector");
 * Y.delegate("hover", overFn, outFn, "#container", ".filterSelector");
 * </code></pre>
 *
 * <p>Additionally, for compatibility with a more typical subscription
 * signature, the following are also supported:</p>
 *
 * <pre><code>Y.on("hover", overFn, ".targetSelector", outFn);
 * Y.delegate("hover", overFn, "#container", outFn, ".filterSelector");
 * </code></pre>
 *
 * @module event
 * @submodule event-hover
 */
var isFunction = Y.Lang.isFunction,
    noop = function () {},
    conf = {
        processArgs: function (args) {
            // Y.delegate('hover', over, out, '#container', '.filter')
            // comes in as ['hover', over, out, '#container', '.filter'], but
            // node.delegate('hover', over, out, '.filter')
            // comes in as ['hover', over, containerEl, out, '.filter']
            var i = isFunction(args[2]) ? 2 : 3;

            return (isFunction(args[i])) ? args.splice(i,1)[0] : noop;
        },

        on: function (node, sub, notifier, filter) {
            var args = (sub.args) ? sub.args.slice() : [];

            args.unshift(null);

            sub._detach = node[(filter) ? "delegate" : "on"]({
                mouseenter: function (e) {
                    e.phase = 'over';
                    notifier.fire(e);
                },
                mouseleave: function (e) {
                    var thisObj = sub.context || this;

                    args[0] = e;

                    e.type = 'hover';
                    e.phase = 'out';
                    sub._extra.apply(thisObj, args);
                }
            }, filter);
        },

        detach: function (node, sub, notifier) {
            sub._detach.detach();
        }
    };

conf.delegate = conf.on;
conf.detachDelegate = conf.detach;

Y.Event.define("hover", conf);


}, '3.17.1', {"requires": ["event-mouseenter"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-outside', function (Y, NAME) {

/**
 * Outside events are synthetic DOM events that fire when a corresponding native
 * or synthetic DOM event occurs outside a bound element.
 *
 * The following outside events are pre-defined by this module:
 * <ul>
 *   <li>blur</li>
 *   <li>change</li>
 *   <li>click</li>
 *   <li>dblclick</li>
 *   <li>focus</li>
 *   <li>keydown</li>
 *   <li>keypress</li>
 *   <li>keyup</li>
 *   <li>mousedown</li>
 *   <li>mousemove</li>
 *   <li>mouseout</li>
 *   <li>mouseover</li>
 *   <li>mouseup</li>
 *   <li>select</li>
 *   <li>submit</li>
 * </ul>
 *
 * Define new outside events with
 * <code>Y.Event.defineOutside(eventType);</code>.
 * By default, the created synthetic event name will be the name of the event
 * with "outside" appended (e.g. "click" becomes "clickoutside"). If you want
 * a different name for the created Event, pass it as a second argument like so:
 * <code>Y.Event.defineOutside(eventType, "yonderclick")</code>.
 *
 * This module was contributed by Brett Stimmerman, promoted from his
 * gallery-outside-events module at
 * http://yuilibrary.com/gallery/show/outside-events
 *
 * @module event
 * @submodule event-outside
 * @author brettstimmerman
 * @since 3.4.0
 */

// Outside events are pre-defined for each of these native DOM events
var nativeEvents = [
        'blur', 'change', 'click', 'dblclick', 'focus', 'keydown', 'keypress',
        'keyup', 'mousedown', 'mousemove', 'mouseout', 'mouseover', 'mouseup',
        'select', 'submit'
    ];

/**
 * Defines a new outside event to correspond with the given DOM event.
 *
 * By default, the created synthetic event name will be the name of the event
 * with "outside" appended (e.g. "click" becomes "clickoutside"). If you want
 * a different name for the created Event, pass it as a second argument like so:
 * <code>Y.Event.defineOutside(eventType, "yonderclick")</code>.
 *
 * @method defineOutside
 * @param {String} event DOM event
 * @param {String} name (optional) custom outside event name
 * @static
 * @for Event
 */
Y.Event.defineOutside = function (event, name) {
    name = name || (event + 'outside');

    var config = {

        on: function (node, sub, notifier) {
            sub.handle = Y.one('doc').on(event, function(e) {
                if (this.isOutside(node, e.target)) {
                    e.currentTarget = node;
                    notifier.fire(e);
                }
            }, this);
        },

        detach: function (node, sub, notifier) {
            sub.handle.detach();
        },

        delegate: function (node, sub, notifier, filter) {
            sub.handle = Y.one('doc').delegate(event, function (e) {
                if (this.isOutside(node, e.target)) {
                    notifier.fire(e);
                }
            }, filter, this);
        },

        isOutside: function (node, target) {
            return target !== node && !target.ancestor(function (p) {
                    return p === node;
                });
        }
    };
    config.detachDelegate = config.detach;

    Y.Event.define(name, config);
};

// Define outside events for some common native DOM events
Y.Array.each(nativeEvents, function (event) {
    Y.Event.defineOutside(event);
});


}, '3.17.1', {"requires": ["event-synthetic"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-touch', function (Y, NAME) {

/**
Adds touch event facade normalization properties (touches, changedTouches, targetTouches etc.) to the DOM event facade. Adds
touch events to the DOM events whitelist.

@example
    YUI().use('event-touch', function (Y) {
        Y.one('#myDiv').on('touchstart', function(e) {
            ...
        });
    });
@module event
@submodule event-touch
 */
var SCALE = "scale",
    ROTATION = "rotation",
    IDENTIFIER = "identifier",
    win = Y.config.win,
    GESTURE_MAP = {};

/**
 * Adds touch event facade normalization properties to the DOM event facade
 *
 * @method _touch
 * @for DOMEventFacade
 * @private
 * @param ev {Event} the DOM event
 * @param currentTarget {HTMLElement} the element the listener was attached to
 * @param wrapper {CustomEvent} the custom event wrapper for this DOM event
 */
Y.DOMEventFacade.prototype._touch = function(e, currentTarget, wrapper) {

    var i,l, etCached, et,touchCache;


    if (e.touches) {

        /**
         * Array of individual touch events for touch points that are still in
         * contact with the touch surface.
         *
         * @property touches
         * @type {DOMEventFacade[]}
         */
        this.touches = [];
        touchCache = {};

        for (i = 0, l = e.touches.length; i < l; ++i) {
            et = e.touches[i];
            touchCache[Y.stamp(et)] = this.touches[i] = new Y.DOMEventFacade(et, currentTarget, wrapper);
        }
    }

    if (e.targetTouches) {

        /**
         * Array of individual touch events still in contact with the touch
         * surface and whose `touchstart` event occurred inside the same taregt
         * element as the current target element.
         *
         * @property targetTouches
         * @type {DOMEventFacade[]}
         */
        this.targetTouches = [];

        for (i = 0, l = e.targetTouches.length; i < l; ++i) {
            et = e.targetTouches[i];
            etCached = touchCache && touchCache[Y.stamp(et, true)];

            this.targetTouches[i] = etCached || new Y.DOMEventFacade(et, currentTarget, wrapper);

        }
    }

    if (e.changedTouches) {

        /**
        An array of event-specific touch events.

        For `touchstart`, the touch points that became active with the current
        event.

        For `touchmove`, the touch points that have changed since the last
        event.

        For `touchend`, the touch points that have been removed from the touch
        surface.

        @property changedTouches
        @type {DOMEventFacade[]}
        **/
        this.changedTouches = [];

        for (i = 0, l = e.changedTouches.length; i < l; ++i) {
            et = e.changedTouches[i];
            etCached = touchCache && touchCache[Y.stamp(et, true)];

            this.changedTouches[i] = etCached || new Y.DOMEventFacade(et, currentTarget, wrapper);

        }
    }

    if (SCALE in e) {
        this[SCALE] = e[SCALE];
    }

    if (ROTATION in e) {
        this[ROTATION] = e[ROTATION];
    }

    if (IDENTIFIER in e) {
        this[IDENTIFIER] = e[IDENTIFIER];
    }
};

//Adding MSPointer events to whitelisted DOM Events. MSPointer event payloads
//have the same properties as mouse events.
if (Y.Node.DOM_EVENTS) {
    Y.mix(Y.Node.DOM_EVENTS, {
        touchstart:1,
        touchmove:1,
        touchend:1,
        touchcancel:1,
        gesturestart:1,
        gesturechange:1,
        gestureend:1,
        MSPointerDown:1,
        MSPointerUp:1,
        MSPointerMove:1,
        MSPointerCancel:1,
        pointerdown:1,
        pointerup:1,
        pointermove:1,
        pointercancel:1
    });
}

//Add properties to Y.EVENT.GESTURE_MAP based on feature detection.
if ((win && ("ontouchstart" in win)) && !(Y.UA.chrome && Y.UA.chrome < 6)) {
    GESTURE_MAP.start = ["touchstart", "mousedown"];
    GESTURE_MAP.end = ["touchend", "mouseup"];
    GESTURE_MAP.move = ["touchmove", "mousemove"];
    GESTURE_MAP.cancel = ["touchcancel", "mousecancel"];
}

else if (win && win.PointerEvent) {
    GESTURE_MAP.start = "pointerdown";
    GESTURE_MAP.end = "pointerup";
    GESTURE_MAP.move = "pointermove";
    GESTURE_MAP.cancel = "pointercancel";
}

else if (win && ("msPointerEnabled" in win.navigator)) {
    GESTURE_MAP.start = "MSPointerDown";
    GESTURE_MAP.end = "MSPointerUp";
    GESTURE_MAP.move = "MSPointerMove";
    GESTURE_MAP.cancel = "MSPointerCancel";
}

else {
    GESTURE_MAP.start = "mousedown";
    GESTURE_MAP.end = "mouseup";
    GESTURE_MAP.move = "mousemove";
    GESTURE_MAP.cancel = "mousecancel";
}

/**
 * A object literal with keys "start", "end", and "move". The value for each key is a
 * string representing the event for that environment. For touch environments, the respective
 * values are "touchstart", "touchend" and "touchmove". Mouse and MSPointer environments are also
 * supported via feature detection.
 *
 * @property _GESTURE_MAP
 * @type Object
 * @static
 */
Y.Event._GESTURE_MAP = GESTURE_MAP;


}, '3.17.1', {"requires": ["node-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-move', function (Y, NAME) {

/**
 * Adds lower level support for "gesturemovestart", "gesturemove" and "gesturemoveend" events, which can be used to create drag/drop
 * interactions which work across touch and mouse input devices. They correspond to "touchstart", "touchmove" and "touchend" on a touch input
 * device, and "mousedown", "mousemove", "mouseup" on a mouse based input device.
 *
 * <p>Documentation for the gesturemove triplet of events can be found on the <a href="../classes/YUI.html#event_gesturemove">YUI</a> global,
 * along with the other supported events.</p>

 @example

     YUI().use('event-move', function (Y) {
         Y.one('#myNode').on('gesturemovestart', function (e) {
         });
         Y.one('#myNode').on('gesturemove', function (e) {
         });
         Y.one('#myNode').on('gesturemoveend', function (e) {
         });
     });

 * @module event-gestures
 * @submodule event-move
 */


 var GESTURE_MAP = Y.Event._GESTURE_MAP,
     EVENT = {
         start: GESTURE_MAP.start,
         end: GESTURE_MAP.end,
         move: GESTURE_MAP.move
     },
    START = "start",
    MOVE = "move",
    END = "end",

    GESTURE_MOVE = "gesture" + MOVE,
    GESTURE_MOVE_END = GESTURE_MOVE + END,
    GESTURE_MOVE_START = GESTURE_MOVE + START,

    _MOVE_START_HANDLE = "_msh",
    _MOVE_HANDLE = "_mh",
    _MOVE_END_HANDLE = "_meh",

    _DEL_MOVE_START_HANDLE = "_dmsh",
    _DEL_MOVE_HANDLE = "_dmh",
    _DEL_MOVE_END_HANDLE = "_dmeh",

    _MOVE_START = "_ms",
    _MOVE = "_m",

    MIN_TIME = "minTime",
    MIN_DISTANCE = "minDistance",
    PREVENT_DEFAULT = "preventDefault",
    BUTTON = "button",
    OWNER_DOCUMENT = "ownerDocument",

    CURRENT_TARGET = "currentTarget",
    TARGET = "target",

    NODE_TYPE = "nodeType",
    SUPPORTS_POINTER = Y.config.win && ("msPointerEnabled" in Y.config.win.navigator),
    MS_TOUCH_ACTION_COUNT = 'msTouchActionCount',
    MS_INIT_TOUCH_ACTION = 'msInitTouchAction',

    _defArgsProcessor = function(se, args, delegate) {
        var iConfig = (delegate) ? 4 : 3,
            config = (args.length > iConfig) ? Y.merge(args.splice(iConfig,1)[0]) : {};

        if (!(PREVENT_DEFAULT in config)) {
            config[PREVENT_DEFAULT] = se.PREVENT_DEFAULT;
        }

        return config;
    },

    _getRoot = function(node, subscriber) {
        return subscriber._extra.root || (node.get(NODE_TYPE) === 9) ? node : node.get(OWNER_DOCUMENT);
    },

    //Checks to see if the node is the document, and if it is, returns the documentElement.
    _checkDocumentElem = function(node) {
        var elem = node.getDOMNode();
        if (node.compareTo(Y.config.doc) && elem.documentElement) {
            return elem.documentElement;
        }
        else {
            return false;
        }
    },

    _normTouchFacade = function(touchFacade, touch, params) {
        touchFacade.pageX = touch.pageX;
        touchFacade.pageY = touch.pageY;
        touchFacade.screenX = touch.screenX;
        touchFacade.screenY = touch.screenY;
        touchFacade.clientX = touch.clientX;
        touchFacade.clientY = touch.clientY;
        touchFacade[TARGET] = touchFacade[TARGET] || touch[TARGET];
        touchFacade[CURRENT_TARGET] = touchFacade[CURRENT_TARGET] || touch[CURRENT_TARGET];

        touchFacade[BUTTON] = (params && params[BUTTON]) || 1; // default to left (left as per vendors, not W3C which is 0)
    },

    /*
    In IE10 touch mode, gestures will not work properly unless the -ms-touch-action CSS property is set to something other than 'auto'. Read http://msdn.microsoft.com/en-us/library/windows/apps/hh767313.aspx for more info. To get around this, we set -ms-touch-action: none which is the same as e.preventDefault() on touch environments. This tells the browser to fire DOM events for all touch events, and not perform any default behavior.

    The user can over-ride this by setting a more lenient -ms-touch-action property on a node (such as pan-x, pan-y, etc.) via CSS when subscribing to the 'gesturemovestart' event.
    */
    _setTouchActions = function (node) {
        var elem = _checkDocumentElem(node) || node.getDOMNode(),
            num = node.getData(MS_TOUCH_ACTION_COUNT);

        //Checks to see if msTouchAction is supported.
        if (SUPPORTS_POINTER) {
            if (!num) {
                num = 0;
                node.setData(MS_INIT_TOUCH_ACTION, elem.style.msTouchAction);
            }
            elem.style.msTouchAction = Y.Event._DEFAULT_TOUCH_ACTION;
            num++;
            node.setData(MS_TOUCH_ACTION_COUNT, num);
        }
    },

    /*
    Resets the element's -ms-touch-action property back to the original value, This is called on detach() and detachDelegate().
    */
    _unsetTouchActions = function (node) {
        var elem = _checkDocumentElem(node) || node.getDOMNode(),
            num = node.getData(MS_TOUCH_ACTION_COUNT),
            initTouchAction = node.getData(MS_INIT_TOUCH_ACTION);

        if (SUPPORTS_POINTER) {
            num--;
            node.setData(MS_TOUCH_ACTION_COUNT, num);
            if (num === 0 && elem.style.msTouchAction !== initTouchAction) {
                elem.style.msTouchAction = initTouchAction;
            }
        }
    },

    _prevent = function(e, preventDefault) {
        if (preventDefault) {
            // preventDefault is a boolean or a function
            if (!preventDefault.call || preventDefault(e)) {
                e.preventDefault();
            }
        }
    },

    define = Y.Event.define;
    Y.Event._DEFAULT_TOUCH_ACTION = 'none';

/**
 * Sets up a "gesturemovestart" event, that is fired on touch devices in response to a single finger "touchstart",
 * and on mouse based devices in response to a "mousedown". The subscriber can specify the minimum time
 * and distance thresholds which should be crossed before the "gesturemovestart" is fired and for the mouse,
 * which button should initiate a "gesturemovestart". This event can also be listened for using node.delegate().
 *
 * <p>It is recommended that you use Y.bind to set up context and additional arguments for your event handler,
 * however if you want to pass the context and arguments as additional signature arguments to on/delegate,
 * you need to provide a null value for the configuration object, e.g: <code>node.on("gesturemovestart", fn, null, context, arg1, arg2, arg3)</code></p>
 *
 * @event gesturemovestart
 * @for YUI
 * @param type {string} "gesturemovestart"
 * @param fn {function} The method the event invokes. It receives the event facade of the underlying DOM event (mousedown or touchstart.touches[0]) which contains position co-ordinates.
 * @param cfg {Object} Optional. An object which specifies:
 *
 * <dl>
 * <dt>minDistance (defaults to 0)</dt>
 * <dd>The minimum distance threshold which should be crossed before the gesturemovestart is fired</dd>
 * <dt>minTime (defaults to 0)</dt>
 * <dd>The minimum time threshold for which the finger/mouse should be help down before the gesturemovestart is fired</dd>
 * <dt>button (no default)</dt>
 * <dd>In the case of a mouse input device, if the event should only be fired for a specific mouse button.</dd>
 * <dt>preventDefault (defaults to false)</dt>
 * <dd>Can be set to true/false to prevent default behavior as soon as the touchstart or mousedown is received (that is before minTime or minDistance thresholds are crossed, and so before the gesturemovestart listener is notified) so that things like text selection and context popups (on touch devices) can be
 * prevented. This property can also be set to a function, which returns true or false, based on the event facade passed to it (for example, DragDrop can determine if the target is a valid handle or not before preventing default).</dd>
 * </dl>
 *
 * @return {EventHandle} the detach handle
 */

define(GESTURE_MOVE_START, {

    on: function (node, subscriber, ce) {

        //Set -ms-touch-action on IE10 and set preventDefault to true
        _setTouchActions(node);

        subscriber[_MOVE_START_HANDLE] = node.on(EVENT[START],
            this._onStart,
            this,
            node,
            subscriber,
            ce);
    },

    delegate : function(node, subscriber, ce, filter) {

        var se = this;

        subscriber[_DEL_MOVE_START_HANDLE] = node.delegate(EVENT[START],
            function(e) {
                se._onStart(e, node, subscriber, ce, true);
            },
            filter);
    },

    detachDelegate : function(node, subscriber, ce, filter) {
        var handle = subscriber[_DEL_MOVE_START_HANDLE];

        if (handle) {
            handle.detach();
            subscriber[_DEL_MOVE_START_HANDLE] = null;
        }

        _unsetTouchActions(node);
    },

    detach: function (node, subscriber, ce) {
        var startHandle = subscriber[_MOVE_START_HANDLE];

        if (startHandle) {
            startHandle.detach();
            subscriber[_MOVE_START_HANDLE] = null;
        }

        _unsetTouchActions(node);
    },

    processArgs : function(args, delegate) {
        var params = _defArgsProcessor(this, args, delegate);

        if (!(MIN_TIME in params)) {
            params[MIN_TIME] = this.MIN_TIME;
        }

        if (!(MIN_DISTANCE in params)) {
            params[MIN_DISTANCE] = this.MIN_DISTANCE;
        }

        return params;
    },

    _onStart : function(e, node, subscriber, ce, delegate) {

        if (delegate) {
            node = e[CURRENT_TARGET];
        }

        var params = subscriber._extra,
            fireStart = true,
            minTime = params[MIN_TIME],
            minDistance = params[MIN_DISTANCE],
            button = params.button,
            preventDefault = params[PREVENT_DEFAULT],
            root = _getRoot(node, subscriber),
            startXY;

        if (e.touches) {
            if (e.touches.length === 1) {
                _normTouchFacade(e, e.touches[0], params);
            } else {
                fireStart = false;
            }
        } else {
            fireStart = (button === undefined) || (button === e.button);
        }


        if (fireStart) {

            _prevent(e, preventDefault);

            if (minTime === 0 || minDistance === 0) {
                this._start(e, node, ce, params);

            } else {

                startXY = [e.pageX, e.pageY];

                if (minTime > 0) {


                    params._ht = Y.later(minTime, this, this._start, [e, node, ce, params]);

                    params._hme = root.on(EVENT[END], Y.bind(function() {
                        this._cancel(params);
                    }, this));
                }

                if (minDistance > 0) {


                    params._hm = root.on(EVENT[MOVE], Y.bind(function(em) {
                        if (Math.abs(em.pageX - startXY[0]) > minDistance || Math.abs(em.pageY - startXY[1]) > minDistance) {
                            this._start(e, node, ce, params);
                        }
                    }, this));
                }
            }
        }
    },

    _cancel : function(params) {
        if (params._ht) {
            params._ht.cancel();
            params._ht = null;
        }
        if (params._hme) {
            params._hme.detach();
            params._hme = null;
        }
        if (params._hm) {
            params._hm.detach();
            params._hm = null;
        }
    },

    _start : function(e, node, ce, params) {

        if (params) {
            this._cancel(params);
        }

        e.type = GESTURE_MOVE_START;


        node.setData(_MOVE_START, e);
        ce.fire(e);
    },

    MIN_TIME : 0,
    MIN_DISTANCE : 0,
    PREVENT_DEFAULT : false
});

/**
 * Sets up a "gesturemove" event, that is fired on touch devices in response to a single finger "touchmove",
 * and on mouse based devices in response to a "mousemove".
 *
 * <p>By default this event is only fired when the same node
 * has received a "gesturemovestart" event. The subscriber can set standAlone to true, in the configuration properties,
 * if they want to listen for this event without an initial "gesturemovestart".</p>
 *
 * <p>By default this event sets up it's internal "touchmove" and "mousemove" DOM listeners on the document element. The subscriber
 * can set the root configuration property, to specify which node to attach DOM listeners to, if different from the document.</p>
 *
 * <p>This event can also be listened for using node.delegate().</p>
 *
 * <p>It is recommended that you use Y.bind to set up context and additional arguments for your event handler,
 * however if you want to pass the context and arguments as additional signature arguments to on/delegate,
 * you need to provide a null value for the configuration object, e.g: <code>node.on("gesturemove", fn, null, context, arg1, arg2, arg3)</code></p>
 *
 * @event gesturemove
 * @for YUI
 * @param type {string} "gesturemove"
 * @param fn {function} The method the event invokes. It receives the event facade of the underlying DOM event (mousemove or touchmove.touches[0]) which contains position co-ordinates.
 * @param cfg {Object} Optional. An object which specifies:
 * <dl>
 * <dt>standAlone (defaults to false)</dt>
 * <dd>true, if the subscriber should be notified even if a "gesturemovestart" has not occured on the same node.</dd>
 * <dt>root (defaults to document)</dt>
 * <dd>The node to which the internal DOM listeners should be attached.</dd>
 * <dt>preventDefault (defaults to false)</dt>
 * <dd>Can be set to true/false to prevent default behavior as soon as the touchmove or mousemove is received. As with gesturemovestart, can also be set to function which returns true/false based on the event facade passed to it.</dd>
 * </dl>
 *
 * @return {EventHandle} the detach handle
 */
define(GESTURE_MOVE, {

    on : function (node, subscriber, ce) {

        _setTouchActions(node);
        var root = _getRoot(node, subscriber, EVENT[MOVE]),

            moveHandle = root.on(EVENT[MOVE],
                this._onMove,
                this,
                node,
                subscriber,
                ce);

        subscriber[_MOVE_HANDLE] = moveHandle;

    },

    delegate : function(node, subscriber, ce, filter) {

        var se = this;

        subscriber[_DEL_MOVE_HANDLE] = node.delegate(EVENT[MOVE],
            function(e) {
                se._onMove(e, node, subscriber, ce, true);
            },
            filter);
    },

    detach : function (node, subscriber, ce) {
        var moveHandle = subscriber[_MOVE_HANDLE];

        if (moveHandle) {
            moveHandle.detach();
            subscriber[_MOVE_HANDLE] = null;
        }

        _unsetTouchActions(node);
    },

    detachDelegate : function(node, subscriber, ce, filter) {
        var handle = subscriber[_DEL_MOVE_HANDLE];

        if (handle) {
            handle.detach();
            subscriber[_DEL_MOVE_HANDLE] = null;
        }

        _unsetTouchActions(node);

    },

    processArgs : function(args, delegate) {
        return _defArgsProcessor(this, args, delegate);
    },

    _onMove : function(e, node, subscriber, ce, delegate) {

        if (delegate) {
            node = e[CURRENT_TARGET];
        }

        var fireMove = subscriber._extra.standAlone || node.getData(_MOVE_START),
            preventDefault = subscriber._extra.preventDefault;


        if (fireMove) {

            if (e.touches) {
                if (e.touches.length === 1) {
                    _normTouchFacade(e, e.touches[0]);
                } else {
                    fireMove = false;
                }
            }

            if (fireMove) {

                _prevent(e, preventDefault);


                e.type = GESTURE_MOVE;
                ce.fire(e);
            }
        }
    },

    PREVENT_DEFAULT : false
});

/**
 * Sets up a "gesturemoveend" event, that is fired on touch devices in response to a single finger "touchend",
 * and on mouse based devices in response to a "mouseup".
 *
 * <p>By default this event is only fired when the same node
 * has received a "gesturemove" or "gesturemovestart" event. The subscriber can set standAlone to true, in the configuration properties,
 * if they want to listen for this event without a preceding "gesturemovestart" or "gesturemove".</p>
 *
 * <p>By default this event sets up it's internal "touchend" and "mouseup" DOM listeners on the document element. The subscriber
 * can set the root configuration property, to specify which node to attach DOM listeners to, if different from the document.</p>
 *
 * <p>This event can also be listened for using node.delegate().</p>
 *
 * <p>It is recommended that you use Y.bind to set up context and additional arguments for your event handler,
 * however if you want to pass the context and arguments as additional signature arguments to on/delegate,
 * you need to provide a null value for the configuration object, e.g: <code>node.on("gesturemoveend", fn, null, context, arg1, arg2, arg3)</code></p>
 *
 *
 * @event gesturemoveend
 * @for YUI
 * @param type {string} "gesturemoveend"
 * @param fn {function} The method the event invokes. It receives the event facade of the underlying DOM event (mouseup or touchend.changedTouches[0]).
 * @param cfg {Object} Optional. An object which specifies:
 * <dl>
 * <dt>standAlone (defaults to false)</dt>
 * <dd>true, if the subscriber should be notified even if a "gesturemovestart" or "gesturemove" has not occured on the same node.</dd>
 * <dt>root (defaults to document)</dt>
 * <dd>The node to which the internal DOM listeners should be attached.</dd>
 * <dt>preventDefault (defaults to false)</dt>
 * <dd>Can be set to true/false to prevent default behavior as soon as the touchend or mouseup is received. As with gesturemovestart, can also be set to function which returns true/false based on the event facade passed to it.</dd>
 * </dl>
 *
 * @return {EventHandle} the detach handle
 */
define(GESTURE_MOVE_END, {

    on : function (node, subscriber, ce) {
        _setTouchActions(node);
        var root = _getRoot(node, subscriber),

            endHandle = root.on(EVENT[END],
                this._onEnd,
                this,
                node,
                subscriber,
                ce);

        subscriber[_MOVE_END_HANDLE] = endHandle;
    },

    delegate : function(node, subscriber, ce, filter) {

        var se = this;

        subscriber[_DEL_MOVE_END_HANDLE] = node.delegate(EVENT[END],
            function(e) {
                se._onEnd(e, node, subscriber, ce, true);
            },
            filter);
    },

    detachDelegate : function(node, subscriber, ce, filter) {
        var handle = subscriber[_DEL_MOVE_END_HANDLE];

        if (handle) {
            handle.detach();
            subscriber[_DEL_MOVE_END_HANDLE] = null;
        }

        _unsetTouchActions(node);

    },

    detach : function (node, subscriber, ce) {
        var endHandle = subscriber[_MOVE_END_HANDLE];

        if (endHandle) {
            endHandle.detach();
            subscriber[_MOVE_END_HANDLE] = null;
        }

        _unsetTouchActions(node);
    },

    processArgs : function(args, delegate) {
        return _defArgsProcessor(this, args, delegate);
    },

    _onEnd : function(e, node, subscriber, ce, delegate) {

        if (delegate) {
            node = e[CURRENT_TARGET];
        }

        var fireMoveEnd = subscriber._extra.standAlone || node.getData(_MOVE) || node.getData(_MOVE_START),
            preventDefault = subscriber._extra.preventDefault;

        if (fireMoveEnd) {

            if (e.changedTouches) {
                if (e.changedTouches.length === 1) {
                    _normTouchFacade(e, e.changedTouches[0]);
                } else {
                    fireMoveEnd = false;
                }
            }

            if (fireMoveEnd) {

                _prevent(e, preventDefault);

                e.type = GESTURE_MOVE_END;
                ce.fire(e);

                node.clearData(_MOVE_START);
                node.clearData(_MOVE);
            }
        }
    },

    PREVENT_DEFAULT : false
});


}, '3.17.1', {"requires": ["node-base", "event-touch", "event-synthetic"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-flick', function (Y, NAME) {

/**
 * The gestures module provides gesture events such as "flick", which normalize user interactions
 * across touch and mouse or pointer based input devices. This layer can be used by application developers
 * to build input device agnostic components which behave the same in response to either touch or mouse based
 * interaction.
 *
 * <p>Documentation for events added by this module can be found in the event document for the <a href="../classes/YUI.html#events">YUI</a> global.</p>
 *
 *
 @example

     YUI().use('event-flick', function (Y) {
         Y.one('#myNode').on('flick', function (e) {
         });
     });

 *
 * @module event-gestures
 */

/**
 * Adds support for a "flick" event, which is fired at the end of a touch or mouse based flick gesture, and provides
 * velocity of the flick, along with distance and time information.
 *
 * <p>Documentation for the flick event can be found on the <a href="../classes/YUI.html#event_flick">YUI</a> global,
 * along with the other supported events.</p>
 *
 * @module event-gestures
 * @submodule event-flick
 */
var GESTURE_MAP = Y.Event._GESTURE_MAP,
    EVENT = {
        start: GESTURE_MAP.start,
        end: GESTURE_MAP.end,
        move: GESTURE_MAP.move
    },
    START = "start",
    END = "end",
    MOVE = "move",

    OWNER_DOCUMENT = "ownerDocument",
    MIN_VELOCITY = "minVelocity",
    MIN_DISTANCE = "minDistance",
    PREVENT_DEFAULT = "preventDefault",

    _FLICK_START = "_fs",
    _FLICK_START_HANDLE = "_fsh",
    _FLICK_END_HANDLE = "_feh",
    _FLICK_MOVE_HANDLE = "_fmh",

    NODE_TYPE = "nodeType";

/**
 * Sets up a "flick" event, that is fired whenever the user initiates a flick gesture on the node
 * where the listener is attached. The subscriber can specify a minimum distance or velocity for
 * which the event is to be fired. The subscriber can also specify if there is a particular axis which
 * they are interested in - "x" or "y". If no axis is specified, the axis along which there was most distance
 * covered is used.
 *
 * <p>It is recommended that you use Y.bind to set up context and additional arguments for your event handler,
 * however if you want to pass the context and arguments as additional signature arguments to "on",
 * you need to provide a null value for the configuration object, e.g: <code>node.on("flick", fn, null, context, arg1, arg2, arg3)</code></p>
 *
 * @event flick
 * @for YUI
 * @param type {string} "flick"
 * @param fn {function} The method the event invokes. It receives an event facade with an e.flick object containing the flick related properties: e.flick.time, e.flick.distance, e.flick.velocity and e.flick.axis, e.flick.start.
 * @param cfg {Object} Optional. An object which specifies any of the following:
 * <dl>
 * <dt>minDistance (in pixels, defaults to 10)</dt>
 * <dd>The minimum distance between start and end points, which would qualify the gesture as a flick.</dd>
 * <dt>minVelocity (in pixels/ms, defaults to 0)</dt>
 * <dd>The minimum velocity which would qualify the gesture as a flick.</dd>
 * <dt>preventDefault (defaults to false)</dt>
 * <dd>Can be set to true/false to prevent default behavior as soon as the touchstart/touchend or mousedown/mouseup is received so that things like scrolling or text selection can be
 * prevented. This property can also be set to a function, which returns true or false, based on the event facade passed to it.</dd>
 * <dt>axis (no default)</dt>
 * <dd>Can be set to "x" or "y" if you want to constrain the flick velocity and distance to a single axis. If not
 * defined, the axis along which the maximum distance was covered is used.</dd>
 * </dl>
 * @return {EventHandle} the detach handle
 */

Y.Event.define('flick', {

    on: function (node, subscriber, ce) {

        var startHandle = node.on(EVENT[START],
            this._onStart,
            this,
            node,
            subscriber,
            ce);

        subscriber[_FLICK_START_HANDLE] = startHandle;
    },

    detach: function (node, subscriber, ce) {

        var startHandle = subscriber[_FLICK_START_HANDLE],
            endHandle = subscriber[_FLICK_END_HANDLE];

        if (startHandle) {
            startHandle.detach();
            subscriber[_FLICK_START_HANDLE] = null;
        }

        if (endHandle) {
            endHandle.detach();
            subscriber[_FLICK_END_HANDLE] = null;
        }
    },

    processArgs: function(args) {
        var params = (args.length > 3) ? Y.merge(args.splice(3, 1)[0]) : {};

        if (!(MIN_VELOCITY in params)) {
            params[MIN_VELOCITY] = this.MIN_VELOCITY;
        }

        if (!(MIN_DISTANCE in params)) {
            params[MIN_DISTANCE] = this.MIN_DISTANCE;
        }

        if (!(PREVENT_DEFAULT in params)) {
            params[PREVENT_DEFAULT] = this.PREVENT_DEFAULT;
        }

        return params;
    },

    _onStart: function(e, node, subscriber, ce) {

        var start = true, // always true for mouse
            endHandle,
            moveHandle,
            doc,
            preventDefault = subscriber._extra.preventDefault,
            origE = e;

        if (e.touches) {
            start = (e.touches.length === 1);
            e = e.touches[0];
        }

        if (start) {

            if (preventDefault) {
                // preventDefault is a boolean or function
                if (!preventDefault.call || preventDefault(e)) {
                    origE.preventDefault();
                }
            }

            e.flick = {
                time : new Date().getTime()
            };

            subscriber[_FLICK_START] = e;

            endHandle = subscriber[_FLICK_END_HANDLE];

            doc = (node.get(NODE_TYPE) === 9) ? node : node.get(OWNER_DOCUMENT);
            if (!endHandle) {
                endHandle = doc.on(EVENT[END], Y.bind(this._onEnd, this), null, node, subscriber, ce);
                subscriber[_FLICK_END_HANDLE] = endHandle;
            }

            subscriber[_FLICK_MOVE_HANDLE] = doc.once(EVENT[MOVE], Y.bind(this._onMove, this), null, node, subscriber, ce);
        }
    },

    _onMove: function(e, node, subscriber, ce) {
        var start = subscriber[_FLICK_START];

        // Start timing from first move.
        if (start && start.flick) {
            start.flick.time = new Date().getTime();
        }
    },

    _onEnd: function(e, node, subscriber, ce) {

        var endTime = new Date().getTime(),
            start = subscriber[_FLICK_START],
            valid = !!start,
            endEvent = e,
            startTime,
            time,
            preventDefault,
            params,
            xyDistance,
            distance,
            velocity,
            axis,
            moveHandle = subscriber[_FLICK_MOVE_HANDLE];

        if (moveHandle) {
            moveHandle.detach();
            delete subscriber[_FLICK_MOVE_HANDLE];
        }

        if (valid) {

            if (e.changedTouches) {
                if (e.changedTouches.length === 1 && e.touches.length === 0) {
                    endEvent = e.changedTouches[0];
                } else {
                    valid = false;
                }
            }

            if (valid) {

                params = subscriber._extra;
                preventDefault = params[PREVENT_DEFAULT];

                if (preventDefault) {
                    // preventDefault is a boolean or function
                    if (!preventDefault.call || preventDefault(e)) {
                        e.preventDefault();
                    }
                }

                startTime = start.flick.time;
                endTime = new Date().getTime();
                time = endTime - startTime;

                xyDistance = [
                    endEvent.pageX - start.pageX,
                    endEvent.pageY - start.pageY
                ];

                if (params.axis) {
                    axis = params.axis;
                } else {
                    axis = (Math.abs(xyDistance[0]) >= Math.abs(xyDistance[1])) ? 'x' : 'y';
                }

                distance = xyDistance[(axis === 'x') ? 0 : 1];
                velocity = (time !== 0) ? distance/time : 0;

                if (isFinite(velocity) && (Math.abs(distance) >= params[MIN_DISTANCE]) && (Math.abs(velocity)  >= params[MIN_VELOCITY])) {

                    e.type = "flick";
                    e.flick = {
                        time:time,
                        distance: distance,
                        velocity:velocity,
                        axis: axis,
                        start : start
                    };

                    ce.fire(e);

                }

                subscriber[_FLICK_START] = null;
            }
        }
    },

    MIN_VELOCITY : 0,
    MIN_DISTANCE : 0,
    PREVENT_DEFAULT : false
});


}, '3.17.1', {"requires": ["node-base", "event-touch", "event-synthetic"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-valuechange', function (Y, NAME) {

/**
Adds a synthetic `valuechange` event that fires when the `value` property of an
`<input>`, `<textarea>`, `<select>`, or `[contenteditable="true"]` node changes
as a result of a keystroke, mouse operation, or input method editor (IME)
input event.

Usage:

    YUI().use('event-valuechange', function (Y) {
        Y.one('#my-input').on('valuechange', function (e) {
        });
    });

@module event-valuechange
**/

/**
Provides the implementation for the synthetic `valuechange` event. This class
isn't meant to be used directly, but is public to make monkeypatching possible.

Usage:

    YUI().use('event-valuechange', function (Y) {
        Y.one('#my-input').on('valuechange', function (e) {
        });
    });

@class ValueChange
@static
*/

var DATA_KEY = '_valuechange',
    VALUE    = 'value',
    NODE_NAME = 'nodeName',

    config, // defined at the end of this file

// Just a simple namespace to make methods overridable.
VC = {
    // -- Static Constants -----------------------------------------------------

    /**
    Interval (in milliseconds) at which to poll for changes to the value of an
    element with one or more `valuechange` subscribers when the user is likely
    to be interacting with it.

    @property POLL_INTERVAL
    @type Number
    @default 50
    @static
    **/
    POLL_INTERVAL: 50,

    /**
    Timeout (in milliseconds) after which to stop polling when there hasn't been
    any new activity (keypresses, mouse clicks, etc.) on an element.

    @property TIMEOUT
    @type Number
    @default 10000
    @static
    **/
    TIMEOUT: 10000,

    // -- Protected Static Methods ---------------------------------------------

    /**
    Called at an interval to poll for changes to the value of the specified
    node.

    @method _poll
    @param {Node} node Node to poll.

    @param {Object} options Options object.
        @param {EventFacade} [options.e] Event facade of the event that
            initiated the polling.

    @protected
    @static
    **/
    _poll: function (node, options) {
        var domNode  = node._node, // performance cheat; getValue() is a big hit when polling
            event    = options.e,
            vcData   = node._data && node._data[DATA_KEY], // another perf cheat
            stopped  = 0,
            facade, prevVal, newVal, nodeName, selectedOption, stopElement;

        if (!(domNode && vcData)) {
            VC._stopPolling(node);
            return;
        }

        prevVal = vcData.prevVal;
        nodeName  = vcData.nodeName;

        if (vcData.isEditable) {
            // Use innerHTML for performance
            newVal = domNode.innerHTML;
        } else if (nodeName === 'input' || nodeName === 'textarea') {
            // Use value property for performance
            newVal = domNode.value;
        } else if (nodeName === 'select') {
            // Back-compatibility with IE6 <select> element values.
            // Huge performance cheat to get past node.get('value').
            selectedOption = domNode.options[domNode.selectedIndex];
            newVal = selectedOption.value || selectedOption.text;
        }

        if (newVal !== prevVal) {
            vcData.prevVal = newVal;

            facade = {
                _event       : event,
                currentTarget: (event && event.currentTarget) || node,
                newVal       : newVal,
                prevVal      : prevVal,
                target       : (event && event.target) || node
            };

            Y.Object.some(vcData.notifiers, function (notifier) {
                var evt = notifier.handle.evt,
                    newStopped;

                // support e.stopPropagation()
                if (stopped !== 1) {
                    notifier.fire(facade);
                } else if (evt.el === stopElement) {
                    notifier.fire(facade);
                }

                newStopped = evt && evt._facade ? evt._facade.stopped : 0;

                // need to consider the condition in which there are two
                // listeners on the same element:
                // listener 1 calls e.stopPropagation()
                // listener 2 calls e.stopImmediatePropagation()
                if (newStopped > stopped) {
                    stopped = newStopped;

                    if (stopped === 1) {
                        stopElement = evt.el;
                    }
                }

                // support e.stopImmediatePropagation()
                if (stopped === 2) {
                    return true;
                }
            });

            VC._refreshTimeout(node);
        }
    },

    /**
    Restarts the inactivity timeout for the specified node.

    @method _refreshTimeout
    @param {Node} node Node to refresh.
    @param {SyntheticEvent.Notifier} notifier
    @protected
    @static
    **/
    _refreshTimeout: function (node, notifier) {
        // The node may have been destroyed, so check that it still exists
        // before trying to get its data. Otherwise an error will occur.
        if (!node._node) {
            return;
        }

        var vcData = node.getData(DATA_KEY);

        VC._stopTimeout(node); // avoid dupes

        // If we don't see any changes within the timeout period (10 seconds by
        // default), stop polling.
        vcData.timeout = setTimeout(function () {
            VC._stopPolling(node, notifier);
        }, VC.TIMEOUT);

    },

    /**
    Begins polling for changes to the `value` property of the specified node. If
    polling is already underway for the specified node, it will not be restarted
    unless the `force` option is `true`

    @method _startPolling
    @param {Node} node Node to watch.
    @param {SyntheticEvent.Notifier} notifier

    @param {Object} options Options object.
        @param {EventFacade} [options.e] Event facade of the event that
            initiated the polling.
        @param {Boolean} [options.force=false] If `true`, polling will be
            restarted even if we're already polling this node.

    @protected
    @static
    **/
    _startPolling: function (node, notifier, options) {
        var vcData, isEditable;

        if (!node.test('input,textarea,select') && !(isEditable = VC._isEditable(node))) {
            return;
        }

        vcData = node.getData(DATA_KEY);

        if (!vcData) {
            vcData = {
                nodeName   : node.get(NODE_NAME).toLowerCase(),
                isEditable : isEditable,
                prevVal    : isEditable ? node.getDOMNode().innerHTML : node.get(VALUE)
            };

            node.setData(DATA_KEY, vcData);
        }

        vcData.notifiers || (vcData.notifiers = {});

        // Don't bother continuing if we're already polling this node, unless
        // `options.force` is true.
        if (vcData.interval) {
            if (options.force) {
                VC._stopPolling(node, notifier); // restart polling, but avoid dupe polls
            } else {
                vcData.notifiers[Y.stamp(notifier)] = notifier;
                return;
            }
        }

        // Poll for changes to the node's value. We can't rely on keyboard
        // events for this, since the value may change due to a mouse-initiated
        // paste event, an IME input event, or for some other reason that
        // doesn't trigger a key event.
        vcData.notifiers[Y.stamp(notifier)] = notifier;

        vcData.interval = setInterval(function () {
            VC._poll(node, options);
        }, VC.POLL_INTERVAL);


        VC._refreshTimeout(node, notifier);
    },

    /**
    Stops polling for changes to the specified node's `value` attribute.

    @method _stopPolling
    @param {Node} node Node to stop polling on.
    @param {SyntheticEvent.Notifier} [notifier] Notifier to remove from the
        node. If not specified, all notifiers will be removed.
    @protected
    @static
    **/
    _stopPolling: function (node, notifier) {
        // The node may have been destroyed, so check that it still exists
        // before trying to get its data. Otherwise an error will occur.
        if (!node._node) {
            return;
        }

        var vcData = node.getData(DATA_KEY) || {};

        clearInterval(vcData.interval);
        delete vcData.interval;

        VC._stopTimeout(node);

        if (notifier) {
            vcData.notifiers && delete vcData.notifiers[Y.stamp(notifier)];
        } else {
            vcData.notifiers = {};
        }

    },

    /**
    Clears the inactivity timeout for the specified node, if any.

    @method _stopTimeout
    @param {Node} node
    @protected
    @static
    **/
    _stopTimeout: function (node) {
        var vcData = node.getData(DATA_KEY) || {};

        clearTimeout(vcData.timeout);
        delete vcData.timeout;
    },

    /**
    Check to see if a node has editable content or not.

    TODO: Add additional checks to get it to work for child nodes
    that inherit "contenteditable" from parent nodes. This may be
    too computationally intensive to be placed inside of the `_poll`
    loop, however.

    @method _isEditable
    @param {Node} node
    @protected
    @static
    **/
    _isEditable: function (node) {
        // Performance cheat because this is used inside `_poll`
        var domNode = node._node;
        return domNode.contentEditable === 'true' ||
               domNode.contentEditable === '';
    },



    // -- Protected Static Event Handlers --------------------------------------

    /**
    Stops polling when a node's blur event fires.

    @method _onBlur
    @param {EventFacade} e
    @param {SyntheticEvent.Notifier} notifier
    @protected
    @static
    **/
    _onBlur: function (e, notifier) {
        VC._stopPolling(e.currentTarget, notifier);
    },

    /**
    Resets a node's history and starts polling when a focus event occurs.

    @method _onFocus
    @param {EventFacade} e
    @param {SyntheticEvent.Notifier} notifier
    @protected
    @static
    **/
    _onFocus: function (e, notifier) {
        var node       = e.currentTarget,
            vcData     = node.getData(DATA_KEY);

        if (!vcData) {
            vcData = {
                isEditable : VC._isEditable(node),
                nodeName   : node.get(NODE_NAME).toLowerCase()
            };
            node.setData(DATA_KEY, vcData);
        }

        vcData.prevVal = vcData.isEditable ? node.getDOMNode().innerHTML : node.get(VALUE);

        VC._startPolling(node, notifier, {e: e});
    },

    /**
    Starts polling when a node receives a keyDown event.

    @method _onKeyDown
    @param {EventFacade} e
    @param {SyntheticEvent.Notifier} notifier
    @protected
    @static
    **/
    _onKeyDown: function (e, notifier) {
        VC._startPolling(e.currentTarget, notifier, {e: e});
    },

    /**
    Starts polling when an IME-related keyUp event occurs on a node.

    @method _onKeyUp
    @param {EventFacade} e
    @param {SyntheticEvent.Notifier} notifier
    @protected
    @static
    **/
    _onKeyUp: function (e, notifier) {
        // These charCodes indicate that an IME has started. We'll restart
        // polling and give the IME up to 10 seconds (by default) to finish.
        if (e.charCode === 229 || e.charCode === 197) {
            VC._startPolling(e.currentTarget, notifier, {
                e    : e,
                force: true
            });
        }
    },

    /**
    Starts polling when a node receives a mouseDown event.

    @method _onMouseDown
    @param {EventFacade} e
    @param {SyntheticEvent.Notifier} notifier
    @protected
    @static
    **/
    _onMouseDown: function (e, notifier) {
        VC._startPolling(e.currentTarget, notifier, {e: e});
    },

    /**
    Called when the `valuechange` event receives a new subscriber.

    Child nodes that aren't initially available when this subscription is
    called will still fire the `valuechange` event after their data is
    collected when the delegated `focus` event is captured. This includes
    elements that haven't been inserted into the DOM yet, as well as
    elements that aren't initially `contenteditable`.

    @method _onSubscribe
    @param {Node} node
    @param {Subscription} sub
    @param {SyntheticEvent.Notifier} notifier
    @param {Function|String} [filter] Filter function or selector string. Only
        provided for delegate subscriptions.
    @protected
    @static
    **/
    _onSubscribe: function (node, sub, notifier, filter) {
        var _valuechange, callbacks, isEditable, inputNodes, editableNodes;

        callbacks = {
            blur     : VC._onBlur,
            focus    : VC._onFocus,
            keydown  : VC._onKeyDown,
            keyup    : VC._onKeyUp,
            mousedown: VC._onMouseDown
        };

        // Store a utility object on the notifier to hold stuff that needs to be
        // passed around to trigger event handlers, polling handlers, etc.
        _valuechange = notifier._valuechange = {};

        if (filter) {
            // If a filter is provided, then this is a delegated subscription.
            _valuechange.delegated = true;

            // Add a function to the notifier that we can use to find all
            // nodes that pass the delegate filter.
            _valuechange.getNodes = function () {
                inputNodes    = node.all('input,textarea,select').filter(filter);
                editableNodes = node.all('[contenteditable="true"],[contenteditable=""]').filter(filter);

                return inputNodes.concat(editableNodes);
            };

            // Store the initial values for each descendant of the container
            // node that passes the delegate filter.
            _valuechange.getNodes().each(function (child) {
                if (!child.getData(DATA_KEY)) {
                    child.setData(DATA_KEY, {
                        nodeName   : child.get(NODE_NAME).toLowerCase(),
                        isEditable : VC._isEditable(child),
                        prevVal    : isEditable ? child.getDOMNode().innerHTML : child.get(VALUE)
                    });
                }
            });

            notifier._handles = Y.delegate(callbacks, node, filter, null,
                notifier);
        } else {
            isEditable = VC._isEditable(node);
            // This is a normal (non-delegated) event subscription.
            if (!node.test('input,textarea,select') && !isEditable) {
                return;
            }

            if (!node.getData(DATA_KEY)) {
                node.setData(DATA_KEY, {
                    nodeName   : node.get(NODE_NAME).toLowerCase(),
                    isEditable : isEditable,
                    prevVal    : isEditable ? node.getDOMNode().innerHTML : node.get(VALUE)
                });
            }

            notifier._handles = node.on(callbacks, null, null, notifier);
        }
    },

    /**
    Called when the `valuechange` event loses a subscriber.

    @method _onUnsubscribe
    @param {Node} node
    @param {Subscription} subscription
    @param {SyntheticEvent.Notifier} notifier
    @protected
    @static
    **/
    _onUnsubscribe: function (node, subscription, notifier) {
        var _valuechange = notifier._valuechange;

        notifier._handles && notifier._handles.detach();

        if (_valuechange.delegated) {
            _valuechange.getNodes().each(function (child) {
                VC._stopPolling(child, notifier);
            });
        } else {
            VC._stopPolling(node, notifier);
        }
    }
};

/**
Synthetic event that fires when the `value` property of an `<input>`,
`<textarea>`, `<select>`, or `[contenteditable="true"]` node changes as a
result of a user-initiated keystroke, mouse operation, or input method
editor (IME) input event.

Unlike the `onchange` event, this event fires when the value actually changes
and not when the element loses focus. This event also reports IME and
multi-stroke input more reliably than `oninput` or the various key events across
browsers.

For performance reasons, only focused nodes are monitored for changes, so
programmatic value changes on nodes that don't have focus won't be detected.

@example

    YUI().use('event-valuechange', function (Y) {
        Y.one('#my-input').on('valuechange', function (e) {
        });
    });

@event valuechange
@param {String} prevVal Previous value prior to the latest change.
@param {String} newVal New value after the latest change.
@for YUI
**/

config = {
    detach: VC._onUnsubscribe,
    on    : VC._onSubscribe,

    delegate      : VC._onSubscribe,
    detachDelegate: VC._onUnsubscribe,

    publishConfig: {
        emitFacade: true
    }
};

Y.Event.define('valuechange', config);
Y.Event.define('valueChange', config); // deprecated, but supported for backcompat

Y.ValueChange = VC;


}, '3.17.1', {"requires": ["event-focus", "event-synthetic"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('event-tap', function (Y, NAME) {

/**
The tap module provides a gesture events, "tap", which normalizes user interactions
across touch and mouse or pointer based input devices.  This can be used by application developers
to build input device agnostic components which behave the same in response to either touch or mouse based
interaction.

'tap' is like a touchscreen 'click', only it requires much less finger-down time since it listens to touch events,
but reverts to mouse events if touch is not supported.

@example

    YUI().use('event-tap', function (Y) {
        Y.one('#my-button').on('tap', function (e) {
        });
    });

@module event
@submodule event-tap
@author Andres Garza, matuzak and tilo mitra
@since 3.7.0

*/
var doc = Y.config.doc,
    GESTURE_MAP = Y.Event._GESTURE_MAP,
    EVT_START = GESTURE_MAP.start,
    EVT_TAP = 'tap',
    POINTER_EVENT_TEST = /pointer/i,

    HANDLES = {
        START: 'Y_TAP_ON_START_HANDLE',
        END: 'Y_TAP_ON_END_HANDLE',
        CANCEL: 'Y_TAP_ON_CANCEL_HANDLE'
    };

function detachHandles(subscription, handles) {
    handles = handles || Y.Object.values(HANDLES);

    Y.Array.each(handles, function (item) {
        var handle = subscription[item];
        if (handle) {
            handle.detach();
            subscription[item] = null;
        }
    });

}


/**
Sets up a "tap" event, that is fired on touch devices in response to a tap event (finger down, finder up).
This event can be used instead of listening for click events which have a 500ms delay on most touch devices.
This event can also be listened for using node.delegate().

@event tap
@param type {string} "tap"
@param fn {function} The method the event invokes. It receives the event facade of the underlying DOM event.
@for Event
@return {EventHandle} the detach handle
*/
Y.Event.define(EVT_TAP, {
    publishConfig: {
        preventedFn: function (e) {
            var sub = e.target.once('click', function (click) {
                click.preventDefault();
            });

            // Make sure to detach the subscription during the next event loop
            // so this doesn't `preventDefault()` on the wrong click event.
            setTimeout(function () {
                sub.detach();
            //Setting this to `0` causes the detachment to occur before the click
            //comes in on Android 4.0.3-4.0.4. 100ms seems to be a reliable number here
            //that works across the board.
            }, 100);
        }
    },

    processArgs: function (args, isDelegate) {

        //if we return for the delegate use case, then the `filter` argument
        //returns undefined, and we have to get the filter from sub._extra[0] (ugly)

        if (!isDelegate) {
            var extra = args[3];
            // remove the extra arguments from the array as specified by
            // http://yuilibrary.com/yui/docs/event/synths.html
            args.splice(3,1);
            return extra;
        }
    },
    /**
    This function should set up the node that will eventually fire the event.

    Usage:

        node.on('tap', function (e) {
        });

    @method on
    @param {Node} node
    @param {Array} subscription
    @param {Boolean} notifier
    @public
    @static
    **/
    on: function (node, subscription, notifier) {
        subscription[HANDLES.START] = node.on(EVT_START, this._start, this, node, subscription, notifier);
    },

    /**
    Detaches all event subscriptions set up by the event-tap module

    @method detach
    @param {Node} node
    @param {Array} subscription
    @param {Boolean} notifier
    @public
    @static
    **/
    detach: function (node, subscription, notifier) {
        detachHandles(subscription);
    },

    /**
    Event delegation for the 'tap' event. The delegated event will use a
    supplied selector or filtering function to test if the event references at least one
    node that should trigger the subscription callback.

    Usage:

        node.delegate('tap', function (e) {
        }, 'li a');

    @method delegate
    @param {Node} node
    @param {Array} subscription
    @param {Boolean} notifier
    @param {String | Function} filter
    @public
    @static
    **/
    delegate: function (node, subscription, notifier, filter) {
        subscription[HANDLES.START] = Y.delegate(EVT_START, function (e) {
            this._start(e, node, subscription, notifier, true);
        }, node, filter, this);
    },

    /**
    Detaches the delegated event subscriptions set up by the event-tap module.
    Only used if you use node.delegate(...) instead of node.on(...);

    @method detachDelegate
    @param {Node} node
    @param {Array} subscription
    @param {Boolean} notifier
    @public
    @static
    **/
    detachDelegate: function (node, subscription, notifier) {
        detachHandles(subscription);
    },

    /**
    Called when the monitor(s) are tapped on, either through touchstart or mousedown.

    @method _start
    @param {DOMEventFacade} event
    @param {Node} node
    @param {Array} subscription
    @param {Boolean} notifier
    @param {Boolean} delegate
    @protected
    @static
    **/
    _start: function (event, node, subscription, notifier, delegate) {

        var context = {
                canceled: false,
                eventType: event.type
            },
            preventMouse = subscription.preventMouse || false;

        //move ways to quit early to the top.
        // no right clicks
        if (event.button && event.button === 3) {
            return;
        }

        // for now just support a 1 finger count (later enhance via config)
        if (event.touches && event.touches.length !== 1) {
            return;
        }

        context.node = delegate ? event.currentTarget : node;

        //There is a double check in here to support event simulation tests, in which
        //event.touches can be undefined when simulating 'touchstart' on touch devices.
        if (event.touches) {
          context.startXY = [ event.touches[0].pageX, event.touches[0].pageY ];
        }
        else {
          context.startXY = [ event.pageX, event.pageY ];
        }

        //If `onTouchStart()` was called by a touch event, set up touch event subscriptions.
        //Otherwise, set up mouse/pointer event event subscriptions.
        if (event.touches) {

            subscription[HANDLES.END] = node.once('touchend', this._end, this, node, subscription, notifier, delegate, context);
            subscription[HANDLES.CANCEL] = node.once('touchcancel', this.detach, this, node, subscription, notifier, delegate, context);

            //Since this is a touch* event, there will be corresponding mouse events
            //that will be fired. We don't want these events to get picked up and fire
            //another `tap` event, so we'll set this variable to `true`.
            subscription.preventMouse = true;
        }

        //Only add these listeners if preventMouse is `false`
        //ie: not when touch events have already been subscribed to
        else if (context.eventType.indexOf('mouse') !== -1 && !preventMouse) {
            subscription[HANDLES.END] = node.once('mouseup', this._end, this, node, subscription, notifier, delegate, context);
            subscription[HANDLES.CANCEL] = node.once('mousecancel', this.detach, this, node, subscription, notifier, delegate, context);
        }

        //If a mouse event comes in after a touch event, it will go in here and
        //reset preventMouse to `true`.
        //If a mouse event comes in without a prior touch event, preventMouse will be
        //false in any case, so this block doesn't do anything.
        else if (context.eventType.indexOf('mouse') !== -1 && preventMouse) {
            subscription.preventMouse = false;
        }

        else if (POINTER_EVENT_TEST.test(context.eventType)) {
            subscription[HANDLES.END] = node.once(GESTURE_MAP.end, this._end, this, node, subscription, notifier, delegate, context);
            subscription[HANDLES.CANCEL] = node.once(GESTURE_MAP.cancel, this.detach, this, node, subscription, notifier, delegate, context);
        }

    },


    /**
    Called when the monitor(s) fires a touchend event (or the mouse equivalent).
    This method fires the 'tap' event if certain requirements are met.

    @method _end
    @param {DOMEventFacade} event
    @param {Node} node
    @param {Array} subscription
    @param {Boolean} notifier
    @param {Boolean} delegate
    @param {Object} context
    @protected
    @static
    **/
    _end: function (event, node, subscription, notifier, delegate, context) {
        var startXY = context.startXY,
            endXY,
            clientXY,
            sensitivity = 15;

        if (subscription._extra && subscription._extra.sensitivity >= 0) {
            sensitivity = subscription._extra.sensitivity;
        }

        //There is a double check in here to support event simulation tests, in which
        //event.touches can be undefined when simulating 'touchstart' on touch devices.
        if (event.changedTouches) {
          endXY = [ event.changedTouches[0].pageX, event.changedTouches[0].pageY ];
          clientXY = [event.changedTouches[0].clientX, event.changedTouches[0].clientY];
        }
        else {
          endXY = [ event.pageX, event.pageY ];
          clientXY = [event.clientX, event.clientY];
        }

        // make sure mouse didn't move
        if (Math.abs(endXY[0] - startXY[0]) <= sensitivity && Math.abs(endXY[1] - startXY[1]) <= sensitivity) {

            event.type = EVT_TAP;
            event.pageX = endXY[0];
            event.pageY = endXY[1];
            event.clientX = clientXY[0];
            event.clientY = clientXY[1];
            event.currentTarget = context.node;

            notifier.fire(event);
        }

        detachHandles(subscription, [HANDLES.END, HANDLES.CANCEL]);
    }
});


}, '3.17.1', {"requires": ["node-base", "event-base", "event-touch", "event-synthetic"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('array-extras', function (Y, NAME) {

/**
Adds additional utility methods to the `Y.Array` class.

@module collection
@submodule array-extras
**/

var A          = Y.Array,
    L          = Y.Lang,
    ArrayProto = Array.prototype;

/**
Returns the index of the last item in the array that contains the specified
value, or `-1` if the value isn't found.

@method lastIndexOf
@param {Array} a Array to search in.
@param {Any} val Value to search for.
@param {Number} [fromIndex] Index at which to start searching backwards.
  Defaults to the array's length - 1. If negative, it will be taken as an offset
  from the end of the array. If the calculated index is less than 0, the array
  will not be searched and `-1` will be returned.
@return {Number} Index of the item that contains the value, or `-1` if not
  found.
@static
@for Array
**/
A.lastIndexOf = L._isNative(ArrayProto.lastIndexOf) ?
    function(a, val, fromIndex) {
        // An undefined fromIndex is still considered a value by some (all?)
        // native implementations, so we can't pass it unless it's actually
        // specified.
        return fromIndex || fromIndex === 0 ? a.lastIndexOf(val, fromIndex) :
                a.lastIndexOf(val);
    } :
    function(a, val, fromIndex) {
        var len = a.length,
            i   = len - 1;

        if (fromIndex || fromIndex === 0) {
            i = Math.min(fromIndex < 0 ? len + fromIndex : fromIndex, len);
        }

        if (i > -1 && len > 0) {
            for (; i > -1; --i) {
                if (i in a && a[i] === val) {
                    return i;
                }
            }
        }

        return -1;
    };

/**
Returns a copy of the input array with duplicate items removed.

Note: If the input array only contains strings, the `Y.Array.dedupe()` method is
a much faster alternative.

@method unique
@param {Array} array Array to dedupe.
@param {Function} [testFn] Custom function to use to test the equality of two
    values. A truthy return value indicates that the values are equal. A falsy
    return value indicates that the values are not equal.

    @param {Any} testFn.a First value to compare.
    @param {Any} testFn.b Second value to compare.
    @param {Number} testFn.index Index of the current item in the original
        array.
    @param {Array} testFn.array The original array.
    @return {Boolean} _true_ if the items are equal, _false_ otherwise.

@return {Array} Copy of the input array with duplicate items removed.
@static
**/
A.unique = function (array, testFn) {
    var i       = 0,
        len     = array.length,
        results = [],
        j, result, resultLen, value;

    // Note the label here. It's used to jump out of the inner loop when a value
    // is not unique.
    outerLoop: for (; i < len; i++) {
        value = array[i];

        // For each value in the input array, iterate through the result array
        // and check for uniqueness against each result value.
        for (j = 0, resultLen = results.length; j < resultLen; j++) {
            result = results[j];

            // If the test function returns true or there's no test function and
            // the value equals the current result item, stop iterating over the
            // results and continue to the next value in the input array.
            if (testFn) {
                if (testFn.call(array, value, result, i, array)) {
                    continue outerLoop;
                }
            } else if (value === result) {
                continue outerLoop;
            }
        }

        // If we get this far, that means the current value is not already in
        // the result array, so add it.
        results.push(value);
    }

    return results;
};

/**
Executes the supplied function on each item in the array. Returns a new array
containing the items for which the supplied function returned a truthy value.

@method filter
@param {Array} a Array to filter.
@param {Function} f Function to execute on each item.
@param {Object} [o] Optional context object.
@return {Array} Array of items for which the supplied function returned a
  truthy value (empty if it never returned a truthy value).
@static
*/
A.filter = L._isNative(ArrayProto.filter) ?
    function(a, f, o) {
        return ArrayProto.filter.call(a, f, o);
    } :
    function(a, f, o) {
        var i       = 0,
            len     = a.length,
            results = [],
            item;

        for (; i < len; ++i) {
            if (i in a) {
                item = a[i];

                if (f.call(o, item, i, a)) {
                    results.push(item);
                }
            }
        }

        return results;
    };

/**
The inverse of `Array.filter()`. Executes the supplied function on each item.
Returns a new array containing the items for which the supplied function
returned `false`.

@method reject
@param {Array} a the array to iterate.
@param {Function} f the function to execute on each item.
@param {object} [o] Optional context object.
@return {Array} The items for which the supplied function returned `false`.
@static
*/
A.reject = function(a, f, o) {
    return A.filter(a, function(item, i, a) {
        return !f.call(o, item, i, a);
    });
};

/**
Executes the supplied function on each item in the array. Iteration stops if the
supplied function does not return a truthy value.

@method every
@param {Array} a the array to iterate.
@param {Function} f the function to execute on each item.
@param {Object} [o] Optional context object.
@return {Boolean} `true` if every item in the array returns `true` from the
  supplied function, `false` otherwise.
@static
*/
A.every = L._isNative(ArrayProto.every) ?
    function(a, f, o) {
        return ArrayProto.every.call(a, f, o);
    } :
    function(a, f, o) {
        for (var i = 0, l = a.length; i < l; ++i) {
            if (i in a && !f.call(o, a[i], i, a)) {
                return false;
            }
        }

        return true;
    };

/**
Executes the supplied function on each item in the array and returns a new array
containing all the values returned by the supplied function.

@example

    // Convert an array of numbers into an array of strings.
    Y.Array.map([1, 2, 3, 4], function (item) {
      return '' + item;
    });
    // => ['1', '2', '3', '4']

@method map
@param {Array} a the array to iterate.
@param {Function} f the function to execute on each item.
@param {object} [o] Optional context object.
@return {Array} A new array containing the return value of the supplied function
  for each item in the original array.
@static
*/
A.map = L._isNative(ArrayProto.map) ?
    function(a, f, o) {
        return ArrayProto.map.call(a, f, o);
    } :
    function(a, f, o) {
        var i       = 0,
            len     = a.length,
            results = ArrayProto.concat.call(a);

        for (; i < len; ++i) {
            if (i in a) {
                results[i] = f.call(o, a[i], i, a);
            }
        }

        return results;
    };


/**
Executes the supplied function on each item in the array, "folding" the array
into a single value.

@method reduce
@param {Array} a Array to iterate.
@param {Any} init Initial value to start with.
@param {Function} f Function to execute on each item. This function should
  update and return the value of the computation. It will receive the following
  arguments:
    @param {Any} f.previousValue Value returned from the previous iteration,
      or the initial value if this is the first iteration.
    @param {Any} f.currentValue Value of the current item being iterated.
    @param {Number} f.index Index of the current item.
    @param {Array} f.array Array being iterated.
@param {Object} [o] Optional context object.
@return {Any} Final result from iteratively applying the given function to each
  element in the array.
@static
*/
A.reduce = L._isNative(ArrayProto.reduce) ?
    function(a, init, f, o) {
        // ES5 Array.reduce doesn't support a thisObject, so we need to
        // implement it manually.
        return ArrayProto.reduce.call(a, function(init, item, i, a) {
            return f.call(o, init, item, i, a);
        }, init);
    } :
    function(a, init, f, o) {
        var i      = 0,
            len    = a.length,
            result = init;

        for (; i < len; ++i) {
            if (i in a) {
                result = f.call(o, result, a[i], i, a);
            }
        }

        return result;
    };

/**
Executes the supplied function on each item in the array, searching for the
first item that matches the supplied function.

@method find
@param {Array} a the array to search.
@param {Function} f the function to execute on each item. Iteration is stopped
  as soon as this function returns `true`.
@param {Object} [o] Optional context object.
@return {Object} the first item that the supplied function returns `true` for,
  or `null` if it never returns `true`.
@static
*/
A.find = function(a, f, o) {
    for (var i = 0, l = a.length; i < l; i++) {
        if (i in a && f.call(o, a[i], i, a)) {
            return a[i];
        }
    }
    return null;
};

/**
Iterates over an array, returning a new array of all the elements that match the
supplied regular expression.

@method grep
@param {Array} a Array to iterate over.
@param {RegExp} pattern Regular expression to test against each item.
@return {Array} All the items in the array that produce a match against the
  supplied regular expression. If no items match, an empty array is returned.
@static
*/
A.grep = function(a, pattern) {
    return A.filter(a, function(item, index) {
        return pattern.test(item);
    });
};

/**
Partitions an array into two new arrays, one with the items for which the
supplied function returns `true`, and one with the items for which the function
returns `false`.

@method partition
@param {Array} a Array to iterate over.
@param {Function} f Function to execute for each item in the array. It will
  receive the following arguments:
    @param {Any} f.item Current item.
    @param {Number} f.index Index of the current item.
    @param {Array} f.array The array being iterated.
@param {Object} [o] Optional execution context.
@return {Object} An object with two properties: `matches` and `rejects`. Each is
  an array containing the items that were selected or rejected by the test
  function (or an empty array if none).
@static
*/
A.partition = function(a, f, o) {
    var results = {
        matches: [],
        rejects: []
    };

    A.each(a, function(item, index) {
        var set = f.call(o, item, index, a) ? results.matches : results.rejects;
        set.push(item);
    });

    return results;
};

/**
Creates an array of arrays by pairing the corresponding elements of two arrays
together into a new array.

@method zip
@param {Array} a Array to iterate over.
@param {Array} a2 Another array whose values will be paired with values of the
  first array.
@return {Array} An array of arrays formed by pairing each element of the first
  array with an item in the second array having the corresponding index.
@static
*/
A.zip = function(a, a2) {
    var results = [];
    A.each(a, function(item, index) {
        results.push([item, a2[index]]);
    });
    return results;
};

/**
Flattens an array of nested arrays at any abitrary depth into a single, flat
array.

@method flatten
@param {Array} a Array with nested arrays to flatten.
@return {Array} An array whose nested arrays have been flattened.
@static
@since 3.7.0
**/
A.flatten = function(a) {
    var result = [],
        i, len, val;

    // Always return an array.
    if (!a) {
        return result;
    }

    for (i = 0, len = a.length; i < len; ++i) {
        val = a[i];

        if (L.isArray(val)) {
            // Recusively flattens any nested arrays.
            result.push.apply(result, A.flatten(val));
        } else {
            result.push(val);
        }
    }

    return result;
};


}, '3.17.1', {"requires": ["yui-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('attribute-core', function (Y, NAME) {

    /**
     * The State class maintains state for a collection of named items, with
     * a varying number of properties defined.
     *
     * It avoids the need to create a separate class for the item, and separate instances
     * of these classes for each item, by storing the state in a 2 level hash table,
     * improving performance when the number of items is likely to be large.
     *
     * @constructor
     * @class State
     */
    Y.State = function() {
        /**
         * Hash of attributes
         * @property data
         */
        this.data = {};
    };

    Y.State.prototype = {

        /**
         * Adds a property to an item.
         *
         * @method add
         * @param name {String} The name of the item.
         * @param key {String} The name of the property.
         * @param val {Any} The value of the property.
         */
        add: function(name, key, val) {
            var item = this.data[name];

            if (!item) {
                item = this.data[name] = {};
            }

            item[key] = val;
        },

        /**
         * Adds multiple properties to an item.
         *
         * @method addAll
         * @param name {String} The name of the item.
         * @param obj {Object} A hash of property/value pairs.
         */
        addAll: function(name, obj) {
            var item = this.data[name],
                key;

            if (!item) {
                item = this.data[name] = {};
            }

            for (key in obj) {
                if (obj.hasOwnProperty(key)) {
                    item[key] = obj[key];
                }
            }
        },

        /**
         * Removes a property from an item.
         *
         * @method remove
         * @param name {String} The name of the item.
         * @param key {String} The property to remove.
         */
        remove: function(name, key) {
            var item = this.data[name];

            if (item) {
                delete item[key];
            }
        },

        /**
         * Removes multiple properties from an item, or removes the item completely.
         *
         * @method removeAll
         * @param name {String} The name of the item.
         * @param obj {Object|Array} Collection of properties to delete. If not provided, the entire item is removed.
         */
        removeAll: function(name, obj) {
            var data;

            if (!obj) {
                data = this.data;

                if (name in data) {
                    delete data[name];
                }
            } else {
                Y.each(obj, function(value, key) {
                    this.remove(name, typeof key === 'string' ? key : value);
                }, this);
            }
        },

        /**
         * For a given item, returns the value of the property requested, or undefined if not found.
         *
         * @method get
         * @param name {String} The name of the item
         * @param key {String} Optional. The property value to retrieve.
         * @return {Any} The value of the supplied property.
         */
        get: function(name, key) {
            var item = this.data[name];

            if (item) {
                return item[key];
            }
        },

        /**
         * For the given item, returns an object with all of the
         * item's property/value pairs. By default the object returned
         * is a shallow copy of the stored data, but passing in true
         * as the second parameter will return a reference to the stored
         * data.
         *
         * @method getAll
         * @param name {String} The name of the item
         * @param reference {boolean} true, if you want a reference to the stored
         * object
         * @return {Object} An object with property/value pairs for the item.
         */
        getAll : function(name, reference) {
            var item = this.data[name],
                key, obj;

            if (reference) {
                obj = item;
            } else if (item) {
                obj = {};

                for (key in item) {
                    if (item.hasOwnProperty(key)) {
                        obj[key] = item[key];
                    }
                }
            }

            return obj;
        }
    };
    /*For log lines*/
    /*jshint maxlen:200*/

    /**
     * The attribute module provides an augmentable Attribute implementation, which
     * adds configurable attributes and attribute change events to the class being
     * augmented. It also provides a State class, which is used internally by Attribute,
     * but can also be used independently to provide a name/property/value data structure to
     * store state.
     *
     * @module attribute
     */

    /**
     * The attribute-core submodule provides the lightest level of attribute handling support
     * without Attribute change events, or lesser used methods such as reset(), modifyAttrs(),
     * and removeAttr().
     *
     * @module attribute
     * @submodule attribute-core
     */
    var O = Y.Object,
        Lang = Y.Lang,

        DOT = ".",

        // Externally configurable props
        GETTER = "getter",
        SETTER = "setter",
        READ_ONLY = "readOnly",
        WRITE_ONCE = "writeOnce",
        INIT_ONLY = "initOnly",
        VALIDATOR = "validator",
        VALUE = "value",
        VALUE_FN = "valueFn",
        LAZY_ADD = "lazyAdd",

        // Used for internal state management
        ADDED = "added",
        BYPASS_PROXY = "_bypassProxy",
        INIT_VALUE = "initValue",
        LAZY = "lazy",

        INVALID_VALUE;

    /**
     * <p>
     * AttributeCore provides the lightest level of configurable attribute support. It is designed to be
     * augmented on to a host class, and provides the host with the ability to configure
     * attributes to store and retrieve state, <strong>but without support for attribute change events</strong>.
     * </p>
     * <p>For example, attributes added to the host can be configured:</p>
     * <ul>
     *     <li>As read only.</li>
     *     <li>As write once.</li>
     *     <li>With a setter function, which can be used to manipulate
     *     values passed to Attribute's <a href="#method_set">set</a> method, before they are stored.</li>
     *     <li>With a getter function, which can be used to manipulate stored values,
     *     before they are returned by Attribute's <a href="#method_get">get</a> method.</li>
     *     <li>With a validator function, to validate values before they are stored.</li>
     * </ul>
     *
     * <p>See the <a href="#method_addAttr">addAttr</a> method, for the complete set of configuration
     * options available for attributes.</p>
     *
     * <p>Object/Classes based on AttributeCore can augment <a href="AttributeObservable.html">AttributeObservable</a>
     * (with true for overwrite) and <a href="AttributeExtras.html">AttributeExtras</a> to add attribute event and
     * additional, less commonly used attribute methods, such as `modifyAttr`, `removeAttr` and `reset`.</p>
     *
     * @class AttributeCore
     * @param attrs {Object} The attributes to add during construction (passed through to <a href="#method_addAttrs">addAttrs</a>).
     *        These can also be defined on the constructor being augmented with Attribute by defining the ATTRS property on the constructor.
     * @param values {Object} The initial attribute values to apply (passed through to <a href="#method_addAttrs">addAttrs</a>).
     *        These are not merged/cloned. The caller is responsible for isolating user provided values if required.
     * @param lazy {boolean} Whether or not to add attributes lazily (passed through to <a href="#method_addAttrs">addAttrs</a>).
     */
    function AttributeCore(attrs, values, lazy) {
        // HACK: Fix #2531929
        // Complete hack, to make sure the first clone of a node value in IE doesn't doesn't hurt state - maintains 3.4.1 behavior.
        // Too late in the release cycle to do anything about the core problem.
        // The root issue is that cloning a Y.Node instance results in an object which barfs in IE, when you access it's properties (since 3.3.0).
        this._yuievt = null;

        this._initAttrHost(attrs, values, lazy);
    }

    /**
     * <p>The value to return from an attribute setter in order to prevent the set from going through.</p>
     *
     * <p>You can return this value from your setter if you wish to combine validator and setter
     * functionality into a single setter function, which either returns the massaged value to be stored or
     * AttributeCore.INVALID_VALUE to prevent invalid values from being stored.</p>
     *
     * @property INVALID_VALUE
     * @type Object
     * @static
     * @final
     */
    AttributeCore.INVALID_VALUE = {};
    INVALID_VALUE = AttributeCore.INVALID_VALUE;

    /**
     * The list of properties which can be configured for
     * each attribute (e.g. setter, getter, writeOnce etc.).
     *
     * This property is used internally as a whitelist for faster
     * Y.mix operations.
     *
     * @property _ATTR_CFG
     * @type Array
     * @static
     * @protected
     */
    AttributeCore._ATTR_CFG = [SETTER, GETTER, VALIDATOR, VALUE, VALUE_FN, WRITE_ONCE, READ_ONLY, LAZY_ADD, BYPASS_PROXY];

    /**
     * Utility method to protect an attribute configuration hash, by merging the
     * entire object and the individual attr config objects.
     *
     * @method protectAttrs
     * @static
     * @param {Object} attrs A hash of attribute to configuration object pairs.
     * @return {Object} A protected version of the `attrs` argument.
     */
    AttributeCore.protectAttrs = function (attrs) {
        if (attrs) {
            attrs = Y.merge(attrs);
            for (var attr in attrs) {
                if (attrs.hasOwnProperty(attr)) {
                    attrs[attr] = Y.merge(attrs[attr]);
                }
            }
        }

        return attrs;
    };

    AttributeCore.prototype = {

        /**
         * Constructor logic for attributes. Initializes the host state, and sets up the inital attributes passed to the
         * constructor.
         *
         * @method _initAttrHost
         * @param attrs {Object} The attributes to add during construction (passed through to <a href="#method_addAttrs">addAttrs</a>).
         *        These can also be defined on the constructor being augmented with Attribute by defining the ATTRS property on the constructor.
         * @param values {Object} The initial attribute values to apply (passed through to <a href="#method_addAttrs">addAttrs</a>).
         *        These are not merged/cloned. The caller is responsible for isolating user provided values if required.
         * @param lazy {boolean} Whether or not to add attributes lazily (passed through to <a href="#method_addAttrs">addAttrs</a>).
         * @private
         */
        _initAttrHost : function(attrs, values, lazy) {
            this._state = new Y.State();
            this._initAttrs(attrs, values, lazy);
        },

        /**
         * <p>
         * Adds an attribute with the provided configuration to the host object.
         * </p>
         * <p>
         * The config argument object supports the following properties:
         * </p>
         *
         * <dl>
         *    <dt>value &#60;Any&#62;</dt>
         *    <dd>The initial value to set on the attribute</dd>
         *
         *    <dt>valueFn &#60;Function | String&#62;</dt>
         *    <dd>
         *    <p>A function, which will return the initial value to set on the attribute. This is useful
         *    for cases where the attribute configuration is defined statically, but needs to
         *    reference the host instance ("this") to obtain an initial value. If both the value and valueFn properties are defined,
         *    the value returned by the valueFn has precedence over the value property, unless it returns undefined, in which
         *    case the value property is used.</p>
         *
         *    <p>valueFn can also be set to a string, representing the name of the instance method to be used to retrieve the value.</p>
         *    </dd>
         *
         *    <dt>readOnly &#60;boolean&#62;</dt>
         *    <dd>Whether or not the attribute is read only. Attributes having readOnly set to true
         *        cannot be modified by invoking the set method.</dd>
         *
         *    <dt>writeOnce &#60;boolean&#62; or &#60;string&#62;</dt>
         *    <dd>
         *        Whether or not the attribute is "write once". Attributes having writeOnce set to true,
         *        can only have their values set once, be it through the default configuration,
         *        constructor configuration arguments, or by invoking set.
         *        <p>The writeOnce attribute can also be set to the string "initOnly",
         *         in which case the attribute can only be set during initialization
         *        (when used with Base, this means it can only be set during construction)</p>
         *    </dd>
         *
         *    <dt>setter &#60;Function | String&#62;</dt>
         *    <dd>
         *    <p>The setter function used to massage or normalize the value passed to the set method for the attribute.
         *    The value returned by the setter will be the final stored value. Returning
         *    <a href="#property_Attribute.INVALID_VALUE">Attribute.INVALID_VALUE</a>, from the setter will prevent
         *    the value from being stored.
         *    </p>
         *
         *    <p>setter can also be set to a string, representing the name of the instance method to be used as the setter function.</p>
         *    </dd>
         *
         *    <dt>getter &#60;Function | String&#62;</dt>
         *    <dd>
         *    <p>
         *    The getter function used to massage or normalize the value returned by the get method for the attribute.
         *    The value returned by the getter function is the value which will be returned to the user when they
         *    invoke get.
         *    </p>
         *
         *    <p>getter can also be set to a string, representing the name of the instance method to be used as the getter function.</p>
         *    </dd>
         *
         *    <dt>validator &#60;Function | String&#62;</dt>
         *    <dd>
         *    <p>
         *    The validator function invoked prior to setting the stored value. Returning
         *    false from the validator function will prevent the value from being stored.
         *    </p>
         *
         *    <p>validator can also be set to a string, representing the name of the instance method to be used as the validator function.</p>
         *    </dd>
         *
         *    <dt>lazyAdd &#60;boolean&#62;</dt>
         *    <dd>Whether or not to delay initialization of the attribute until the first call to get/set it.
         *    This flag can be used to over-ride lazy initialization on a per attribute basis, when adding multiple attributes through
         *    the <a href="#method_addAttrs">addAttrs</a> method.</dd>
         *
         * </dl>
         *
         * <p>The setter, getter and validator are invoked with the value and name passed in as the first and second arguments, and with
         * the context ("this") set to the host object.</p>
         *
         * <p>Configuration properties outside of the list mentioned above are considered private properties used internally by attribute,
         * and are not intended for public use.</p>
         *
         * @method addAttr
         *
         * @param {String} name The name of the attribute.
         * @param {Object} config An object with attribute configuration property/value pairs, specifying the configuration for the attribute.
         *
         * <p>
         * <strong>NOTE:</strong> The configuration object is modified when adding an attribute, so if you need
         * to protect the original values, you will need to merge the object.
         * </p>
         *
         * @param {boolean} lazy (optional) Whether or not to add this attribute lazily (on the first call to get/set).
         *
         * @return {Object} A reference to the host object.
         *
         * @chainable
         */
        addAttr : function(name, config, lazy) {


            var host = this, // help compression
                state = host._state,
                data = state.data,
                value,
                added,
                hasValue;

            config = config || {};

            if (LAZY_ADD in config) {
                lazy = config[LAZY_ADD];
            }

            added = state.get(name, ADDED);

            if (lazy && !added) {
                state.data[name] = {
                    lazy : config,
                    added : true
                };
            } else {


                if (!added || config.isLazyAdd) {

                    hasValue = (VALUE in config);


                    if (hasValue) {

                        // We'll go through set, don't want to set value in config directly

                        // PERF TODO: VALIDATE: See if setting this to undefined is sufficient. We use to delete before.
                        // In certain code paths/use cases, undefined may not be the same as not present.
                        // If not, we can set it to some known fixed value (like INVALID_VALUE, say INITIALIZING_VALUE) for performance,
                        // to avoid a delete which seems to help a lot.

                        value = config.value;
                        config.value = undefined;
                    }

                    config.added = true;
                    config.initializing = true;

                    data[name] = config;

                    if (hasValue) {
                        // Go through set, so that raw values get normalized/validated
                        host.set(name, value);
                    }

                    config.initializing = false;
                }
            }

            return host;
        },

        /**
         * Checks if the given attribute has been added to the host
         *
         * @method attrAdded
         * @param {String} name The name of the attribute to check.
         * @return {boolean} true if an attribute with the given name has been added, false if it hasn't.
         *         This method will return true for lazily added attributes.
         */
        attrAdded: function(name) {
            return !!(this._state.get(name, ADDED));
        },

        /**
         * Returns the current value of the attribute. If the attribute
         * has been configured with a 'getter' function, this method will delegate
         * to the 'getter' to obtain the value of the attribute.
         *
         * @method get
         *
         * @param {String} name The name of the attribute. If the value of the attribute is an Object,
         * dot notation can be used to obtain the value of a property of the object (e.g. <code>get("x.y.z")</code>)
         *
         * @return {Any} The value of the attribute
         */
        get : function(name) {
            return this._getAttr(name);
        },

        /**
         * Checks whether or not the attribute is one which has been
         * added lazily and still requires initialization.
         *
         * @method _isLazyAttr
         * @private
         * @param {String} name The name of the attribute
         * @return {boolean} true if it's a lazily added attribute, false otherwise.
         */
        _isLazyAttr: function(name) {
            return this._state.get(name, LAZY);
        },

        /**
         * Finishes initializing an attribute which has been lazily added.
         *
         * @method _addLazyAttr
         * @private
         * @param {Object} name The name of the attribute
         * @param {Object} [lazyCfg] Optional config hash for the attribute. This is added for performance
         * along the critical path, where the calling method has already obtained lazy config from state.
         */
        _addLazyAttr: function(name, lazyCfg) {
            var state = this._state;

            lazyCfg = lazyCfg || state.get(name, LAZY);

            if (lazyCfg) {

                // PERF TODO: For App's id override, otherwise wouldn't be
                // needed. It expects to find it in the cfg for it's
                // addAttr override. Would like to remove, once App override is
                // removed.
                state.data[name].lazy = undefined;

                lazyCfg.isLazyAdd = true;

                this.addAttr(name, lazyCfg);
            }
        },

        /**
         * Sets the value of an attribute.
         *
         * @method set
         * @chainable
         *
         * @param {String} name The name of the attribute. If the
         * current value of the attribute is an Object, dot notation can be used
         * to set the value of a property within the object (e.g. <code>set("x.y.z", 5)</code>).
         * @param {Any} value The value to set the attribute to.
         * @param {Object} [opts] Optional data providing the circumstances for the change.
         * @return {Object} A reference to the host object.
         */
        set : function(name, val, opts) {
            return this._setAttr(name, val, opts);
        },

        /**
         * Allows setting of readOnly/writeOnce attributes. See <a href="#method_set">set</a> for argument details.
         *
         * @method _set
         * @protected
         * @chainable
         *
         * @param {String} name The name of the attribute.
         * @param {Any} val The value to set the attribute to.
         * @param {Object} [opts] Optional data providing the circumstances for the change.
         * @return {Object} A reference to the host object.
         */
        _set : function(name, val, opts) {
            return this._setAttr(name, val, opts, true);
        },

        /**
         * Provides the common implementation for the public set and protected _set methods.
         *
         * See <a href="#method_set">set</a> for argument details.
         *
         * @method _setAttr
         * @protected
         * @chainable
         *
         * @param {String} name The name of the attribute.
         * @param {Any} value The value to set the attribute to.
         * @param {Object} [opts] Optional data providing the circumstances for the change.
         * @param {boolean} force If true, allows the caller to set values for
         * readOnly or writeOnce attributes which have already been set.
         *
         * @return {Object} A reference to the host object.
         */
        _setAttr : function(name, val, opts, force)  {
            var allowSet = true,
                state = this._state,
                stateProxy = this._stateProxy,
                tCfgs = this._tCfgs,
                cfg,
                initialSet,
                strPath,
                path,
                currVal,
                writeOnce,
                initializing;

            if (name.indexOf(DOT) !== -1) {
                strPath = name;

                path = name.split(DOT);
                name = path.shift();
            }

            // On Demand - Should be rare - handles out of order valueFn, setter, getter references
            if (tCfgs && tCfgs[name]) {
                this._addOutOfOrder(name, tCfgs[name]);
            }

            cfg = state.data[name] || {};

            if (cfg.lazy) {
                cfg = cfg.lazy;
                this._addLazyAttr(name, cfg);
            }

            initialSet = (cfg.value === undefined);

            if (stateProxy && name in stateProxy && !cfg._bypassProxy) {
                // TODO: Value is always set for proxy. Can we do any better? Maybe take a snapshot as the initial value for the first call to set?
                initialSet = false;
            }

            writeOnce = cfg.writeOnce;
            initializing = cfg.initializing;

            if (!initialSet && !force) {

                if (writeOnce) {
                    allowSet = false;
                }

                if (cfg.readOnly) {
                    allowSet = false;
                }
            }

            if (!initializing && !force && writeOnce === INIT_ONLY) {
                allowSet = false;
            }

            if (allowSet) {
                // Don't need currVal if initialSet (might fail in custom getter if it always expects a non-undefined/non-null value)
                if (!initialSet) {
                    currVal =  this.get(name);
                }

                if (path) {
                   val = O.setValue(Y.clone(currVal), path, val);

                   if (val === undefined) {
                       allowSet = false;
                   }
                }

                if (allowSet) {
                    if (!this._fireAttrChange || initializing) {
                        this._setAttrVal(name, strPath, currVal, val, opts, cfg);
                    } else {
                        // HACK - no real reason core needs to know about _fireAttrChange, but
                        // it adds fn hops if we want to break it out. Not sure it's worth it for this critical path
                        this._fireAttrChange(name, strPath, currVal, val, opts, cfg);
                    }
                }
            }

            return this;
        },

        /**
         * Utility method used by get/set to add attributes
         * encountered out of order when calling addAttrs().
         *
         * For example, if:
         *
         *     this.addAttrs({
         *          foo: {
         *              setter: function() {
         *                 // make sure this bar is available when foo is added
         *                 this.get("bar");
         *              }
         *          },
         *          bar: {
         *              value: ...
         *          }
         *     });
         *
         * @method _addOutOfOrder
         * @private
         * @param name {String} attribute name
         * @param cfg {Object} attribute configuration
         */
        _addOutOfOrder : function(name, cfg) {

            var attrs = {};
            attrs[name] = cfg;

            delete this._tCfgs[name];

            // TODO: The original code went through addAttrs, so
            // sticking with it for this pass. Seems like we could
            // just jump straight to _addAttr() and get some perf
            // improvement.
            this._addAttrs(attrs, this._tVals);
        },

        /**
         * Provides the common implementation for the public get method,
         * allowing Attribute hosts to over-ride either method.
         *
         * See <a href="#method_get">get</a> for argument details.
         *
         * @method _getAttr
         * @protected
         * @chainable
         *
         * @param {String} name The name of the attribute.
         * @return {Any} The value of the attribute.
         */
        _getAttr : function(name) {
            var fullName = name,
                tCfgs = this._tCfgs,
                path,
                getter,
                val,
                attrCfg;

            if (name.indexOf(DOT) !== -1) {
                path = name.split(DOT);
                name = path.shift();
            }

            // On Demand - Should be rare - handles out of
            // order valueFn, setter, getter references
            if (tCfgs && tCfgs[name]) {
                this._addOutOfOrder(name, tCfgs[name]);
            }

            attrCfg = this._state.data[name] || {};

            // Lazy Init
            if (attrCfg.lazy) {
                attrCfg = attrCfg.lazy;
                this._addLazyAttr(name, attrCfg);
            }

            val = this._getStateVal(name, attrCfg);

            getter = attrCfg.getter;

            if (getter && !getter.call) {
                getter = this[getter];
            }

            val = (getter) ? getter.call(this, val, fullName) : val;
            val = (path) ? O.getValue(val, path) : val;

            return val;
        },

        /**
         * Gets the stored value for the attribute, from either the
         * internal state object, or the state proxy if it exits
         *
         * @method _getStateVal
         * @private
         * @param {String} name The name of the attribute
         * @param {Object} [cfg] Optional config hash for the attribute. This is added for performance along the critical path,
         * where the calling method has already obtained the config from state.
         *
         * @return {Any} The stored value of the attribute
         */
        _getStateVal : function(name, cfg) {
            var stateProxy = this._stateProxy;

            if (!cfg) {
                cfg = this._state.getAll(name) || {};
            }

            return (stateProxy && (name in stateProxy) && !(cfg._bypassProxy)) ? stateProxy[name] : cfg.value;
        },

        /**
         * Sets the stored value for the attribute, in either the
         * internal state object, or the state proxy if it exits
         *
         * @method _setStateVal
         * @private
         * @param {String} name The name of the attribute
         * @param {Any} value The value of the attribute
         */
        _setStateVal : function(name, value) {
            var stateProxy = this._stateProxy;
            if (stateProxy && (name in stateProxy) && !this._state.get(name, BYPASS_PROXY)) {
                stateProxy[name] = value;
            } else {
                this._state.add(name, VALUE, value);
            }
        },

        /**
         * Updates the stored value of the attribute in the privately held State object,
         * if validation and setter passes.
         *
         * @method _setAttrVal
         * @private
         * @param {String} attrName The attribute name.
         * @param {String} subAttrName The sub-attribute name, if setting a sub-attribute property ("x.y.z").
         * @param {Any} prevVal The currently stored value of the attribute.
         * @param {Any} newVal The value which is going to be stored.
         * @param {Object} [opts] Optional data providing the circumstances for the change.
         * @param {Object} [attrCfg] Optional config hash for the attribute. This is added for performance along the critical path,
         * where the calling method has already obtained the config from state.
         *
         * @return {Boolean} true if the new attribute value was stored, false if not.
         */
        _setAttrVal : function(attrName, subAttrName, prevVal, newVal, opts, attrCfg) {

            var host = this,
                allowSet = true,
                cfg = attrCfg || this._state.data[attrName] || {},
                validator = cfg.validator,
                setter = cfg.setter,
                initializing = cfg.initializing,
                prevRawVal = this._getStateVal(attrName, cfg),
                name = subAttrName || attrName,
                retVal,
                valid;

            if (validator) {
                if (!validator.call) {
                    // Assume string - trying to keep critical path tight, so avoiding Lang check
                    validator = this[validator];
                }
                if (validator) {
                    valid = validator.call(host, newVal, name, opts);

                    if (!valid && initializing) {
                        newVal = cfg.defaultValue;
                        valid = true; // Assume it's valid, for perf.
                    }
                }
            }

            if (!validator || valid) {
                if (setter) {
                    if (!setter.call) {
                        // Assume string - trying to keep critical path tight, so avoiding Lang check
                        setter = this[setter];
                    }
                    if (setter) {
                        retVal = setter.call(host, newVal, name, opts);

                        if (retVal === INVALID_VALUE) {
                            if (initializing) {
                                newVal = cfg.defaultValue;
                            } else {
                                allowSet = false;
                            }
                        } else if (retVal !== undefined){
                            newVal = retVal;
                        }
                    }
                }

                if (allowSet) {
                    if(!subAttrName && (newVal === prevRawVal) && !Lang.isObject(newVal)) {
                        allowSet = false;
                    } else {
                        // Store value
                        if (!(INIT_VALUE in cfg)) {
                            cfg.initValue = newVal;
                        }
                        host._setStateVal(attrName, newVal);
                    }
                }

            } else {
                allowSet = false;
            }

            return allowSet;
        },

        /**
         * Sets multiple attribute values.
         *
         * @method setAttrs
         * @param {Object} attrs  An object with attributes name/value pairs.
         * @param {Object} [opts] Optional data providing the circumstances for the change.
         * @return {Object} A reference to the host object.
         * @chainable
         */
        setAttrs : function(attrs, opts) {
            return this._setAttrs(attrs, opts);
        },

        /**
         * Implementation behind the public setAttrs method, to set multiple attribute values.
         *
         * @method _setAttrs
         * @protected
         * @param {Object} attrs  An object with attributes name/value pairs.
         * @param {Object} [opts] Optional data providing the circumstances for the change
         * @return {Object} A reference to the host object.
         * @chainable
         */
        _setAttrs : function(attrs, opts) {
            var attr;
            for (attr in attrs) {
                if ( attrs.hasOwnProperty(attr) ) {
                    this.set(attr, attrs[attr], opts);
                }
            }
            return this;
        },

        /**
         * Gets multiple attribute values.
         *
         * @method getAttrs
         * @param {String[]|Boolean} attrs Optional. An array of attribute names. If omitted, all attribute values are
         * returned. If set to true, all attributes modified from their initial values are returned.
         * @return {Object} An object with attribute name/value pairs.
         */
        getAttrs : function(attrs) {
            return this._getAttrs(attrs);
        },

        /**
         * Implementation behind the public getAttrs method, to get multiple attribute values.
         *
         * @method _getAttrs
         * @protected
         * @param {String[]|Boolean} attrs Optional. An array of attribute names. If omitted, all attribute values are
         * returned. If set to true, all attributes modified from their initial values are returned.
         * @return {Object} An object with attribute name/value pairs.
         */
        _getAttrs : function(attrs) {
            var obj = {},
                attr, i, len,
                modifiedOnly = (attrs === true);

            // TODO - figure out how to get all "added"
            if (!attrs || modifiedOnly) {
                attrs = O.keys(this._state.data);
            }

            for (i = 0, len = attrs.length; i < len; i++) {
                attr = attrs[i];

                if (!modifiedOnly || this._getStateVal(attr) != this._state.get(attr, INIT_VALUE)) {
                    // Go through get, to honor cloning/normalization
                    obj[attr] = this.get(attr);
                }
            }

            return obj;
        },

        /**
         * Configures a group of attributes, and sets initial values.
         *
         * <p>
         * <strong>NOTE:</strong> This method does not isolate the configuration object by merging/cloning.
         * The caller is responsible for merging/cloning the configuration object if required.
         * </p>
         *
         * @method addAttrs
         * @chainable
         *
         * @param {Object} cfgs An object with attribute name/configuration pairs.
         * @param {Object} values An object with attribute name/value pairs, defining the initial values to apply.
         * Values defined in the cfgs argument will be over-written by values in this argument unless defined as read only.
         * @param {boolean} lazy Whether or not to delay the intialization of these attributes until the first call to get/set.
         * Individual attributes can over-ride this behavior by defining a lazyAdd configuration property in their configuration.
         * See <a href="#method_addAttr">addAttr</a>.
         *
         * @return {Object} A reference to the host object.
         */
        addAttrs : function(cfgs, values, lazy) {
            if (cfgs) {
                this._tCfgs = cfgs;
                this._tVals = (values) ? this._normAttrVals(values) : null;
                this._addAttrs(cfgs, this._tVals, lazy);
                this._tCfgs = this._tVals = null;
            }

            return this;
        },

        /**
         * Implementation behind the public addAttrs method.
         *
         * This method is invoked directly by get if it encounters a scenario
         * in which an attribute's valueFn attempts to obtain the
         * value an attribute in the same group of attributes, which has not yet
         * been added (on demand initialization).
         *
         * @method _addAttrs
         * @private
         * @param {Object} cfgs An object with attribute name/configuration pairs.
         * @param {Object} values An object with attribute name/value pairs, defining the initial values to apply.
         * Values defined in the cfgs argument will be over-written by values in this argument unless defined as read only.
         * @param {boolean} lazy Whether or not to delay the intialization of these attributes until the first call to get/set.
         * Individual attributes can over-ride this behavior by defining a lazyAdd configuration property in their configuration.
         * See <a href="#method_addAttr">addAttr</a>.
         */
        _addAttrs : function(cfgs, values, lazy) {
            var tCfgs = this._tCfgs,
                tVals = this._tVals,
                attr,
                attrCfg,
                value;

            for (attr in cfgs) {
                if (cfgs.hasOwnProperty(attr)) {

                    // Not Merging. Caller is responsible for isolating configs
                    attrCfg = cfgs[attr];
                    attrCfg.defaultValue = attrCfg.value;

                    // Handle simple, complex and user values, accounting for read-only
                    value = this._getAttrInitVal(attr, attrCfg, tVals);

                    if (value !== undefined) {
                        attrCfg.value = value;
                    }

                    if (tCfgs[attr]) {
                        tCfgs[attr] = undefined;
                    }

                    this.addAttr(attr, attrCfg, lazy);
                }
            }
        },

        /**
         * Utility method to protect an attribute configuration
         * hash, by merging the entire object and the individual
         * attr config objects.
         *
         * @method _protectAttrs
         * @protected
         * @param {Object} attrs A hash of attribute to configuration object pairs.
         * @return {Object} A protected version of the attrs argument.
         * @deprecated Use `AttributeCore.protectAttrs()` or
         *   `Attribute.protectAttrs()` which are the same static utility method.
         */
        _protectAttrs : AttributeCore.protectAttrs,

        /**
         * Utility method to normalize attribute values. The base implementation
         * simply merges the hash to protect the original.
         *
         * @method _normAttrVals
         * @param {Object} valueHash An object with attribute name/value pairs
         *
         * @return {Object} An object literal with 2 properties - "simple" and "complex",
         * containing simple and complex attribute values respectively keyed
         * by the top level attribute name, or null, if valueHash is falsey.
         *
         * @private
         */
        _normAttrVals : function(valueHash) {
            var vals,
                subvals,
                path,
                attr,
                v, k;

            if (!valueHash) {
                return null;
            }

            vals = {};

            for (k in valueHash) {
                if (valueHash.hasOwnProperty(k)) {
                    if (k.indexOf(DOT) !== -1) {
                        path = k.split(DOT);
                        attr = path.shift();

                        subvals = subvals || {};

                        v = subvals[attr] = subvals[attr] || [];
                        v[v.length] = {
                            path : path,
                            value: valueHash[k]
                        };
                    } else {
                        vals[k] = valueHash[k];
                    }
                }
            }

            return { simple:vals, complex:subvals };
        },

        /**
         * Returns the initial value of the given attribute from
         * either the default configuration provided, or the
         * over-ridden value if it exists in the set of initValues
         * provided and the attribute is not read-only.
         *
         * @param {String} attr The name of the attribute
         * @param {Object} cfg The attribute configuration object
         * @param {Object} initValues The object with simple and complex attribute name/value pairs returned from _normAttrVals
         *
         * @return {Any} The initial value of the attribute.
         *
         * @method _getAttrInitVal
         * @private
         */
        _getAttrInitVal : function(attr, cfg, initValues) {
            var val = cfg.value,
                valFn = cfg.valueFn,
                tmpVal,
                initValSet = false,
                readOnly = cfg.readOnly,
                simple,
                complex,
                i,
                l,
                path,
                subval,
                subvals;

            if (!readOnly && initValues) {
                // Simple Attributes
                simple = initValues.simple;
                if (simple && simple.hasOwnProperty(attr)) {
                    val = simple[attr];
                    initValSet = true;
                }
            }

            if (valFn && !initValSet) {
                if (!valFn.call) {
                    valFn = this[valFn];
                }
                if (valFn) {
                    tmpVal = valFn.call(this, attr);
                    val = tmpVal;
                }
            }

            if (!readOnly && initValues) {

                // Complex Attributes (complex values applied, after simple, in case both are set)
                complex = initValues.complex;

                if (complex && complex.hasOwnProperty(attr) && (val !== undefined) && (val !== null)) {
                    subvals = complex[attr];
                    for (i = 0, l = subvals.length; i < l; ++i) {
                        path = subvals[i].path;
                        subval = subvals[i].value;
                        O.setValue(val, path, subval);
                    }
                }
            }

            return val;
        },

        /**
         * Utility method to set up initial attributes defined during construction,
         * either through the constructor.ATTRS property, or explicitly passed in.
         *
         * @method _initAttrs
         * @protected
         * @param attrs {Object} The attributes to add during construction (passed through to <a href="#method_addAttrs">addAttrs</a>).
         *        These can also be defined on the constructor being augmented with Attribute by defining the ATTRS property on the constructor.
         * @param values {Object} The initial attribute values to apply (passed through to <a href="#method_addAttrs">addAttrs</a>).
         *        These are not merged/cloned. The caller is responsible for isolating user provided values if required.
         * @param lazy {boolean} Whether or not to add attributes lazily (passed through to <a href="#method_addAttrs">addAttrs</a>).
         */
        _initAttrs : function(attrs, values, lazy) {
            // ATTRS support for Node, which is not Base based
            attrs = attrs || this.constructor.ATTRS;

            var Base = Y.Base,
                BaseCore = Y.BaseCore,
                baseInst = (Base && Y.instanceOf(this, Base)),
                baseCoreInst = (!baseInst && BaseCore && Y.instanceOf(this, BaseCore));

            if (attrs && !baseInst && !baseCoreInst) {
                this.addAttrs(Y.AttributeCore.protectAttrs(attrs), values, lazy);
            }
        }
    };

    Y.AttributeCore = AttributeCore;


}, '3.17.1', {"requires": ["oop"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('attribute-observable', function (Y, NAME) {

    /*For log lines*/
    /*jshint maxlen:200*/


    /**
     * The attribute module provides an augmentable Attribute implementation, which
     * adds configurable attributes and attribute change events to the class being
     * augmented. It also provides a State class, which is used internally by Attribute,
     * but can also be used independently to provide a name/property/value data structure to
     * store state.
     *
     * @module attribute
     */

    /**
     * The `attribute-observable` submodule provides augmentable attribute change event support
     * for AttributeCore based implementations.
     *
     * @module attribute
     * @submodule attribute-observable
     */
    var EventTarget = Y.EventTarget,

        CHANGE = "Change",
        BROADCAST = "broadcast";

    /**
     * Provides an augmentable implementation of attribute change events for
     * AttributeCore.
     *
     * @class AttributeObservable
     * @extensionfor AttributeCore
     * @uses EventTarget
     */
    function AttributeObservable() {
        // Perf tweak - avoid creating event literals if not required.
        this._ATTR_E_FACADE = {};

        EventTarget.call(this, {emitFacade:true});
    }

    AttributeObservable._ATTR_CFG = [BROADCAST];

    AttributeObservable.prototype = {

        /**
         * Sets the value of an attribute.
         *
         * @method set
         * @chainable
         *
         * @param {String} name The name of the attribute. If the
         * current value of the attribute is an Object, dot notation can be used
         * to set the value of a property within the object (e.g. <code>set("x.y.z", 5)</code>).
         *
         * @param {Any} value The value to set the attribute to.
         *
         * @param {Object} opts (Optional) Optional event data to be mixed into
         * the event facade passed to subscribers of the attribute's change event. This
         * can be used as a flexible way to identify the source of a call to set, allowing
         * the developer to distinguish between set called internally by the host, vs.
         * set called externally by the application developer.
         *
         * @return {Object} A reference to the host object.
         */
        set : function(name, val, opts) {
            return this._setAttr(name, val, opts);
        },

        /**
         * Allows setting of readOnly/writeOnce attributes. See <a href="#method_set">set</a> for argument details.
         *
         * @method _set
         * @protected
         * @chainable
         *
         * @param {String} name The name of the attribute.
         * @param {Any} val The value to set the attribute to.
         * @param {Object} opts (Optional) Optional event data to be mixed into
         * the event facade passed to subscribers of the attribute's change event.
         * @return {Object} A reference to the host object.
         */
        _set : function(name, val, opts) {
            return this._setAttr(name, val, opts, true);
        },

        /**
         * Sets multiple attribute values.
         *
         * @method setAttrs
         * @param {Object} attrs  An object with attributes name/value pairs.
         * @param {Object} opts  Properties to mix into the event payload. These are shared and mixed into each set
         * @return {Object} A reference to the host object.
         * @chainable
         */
        setAttrs : function(attrs, opts) {
            return this._setAttrs(attrs, opts);
        },

        /**
         * Implementation behind the public setAttrs method, to set multiple attribute values.
         *
         * @method _setAttrs
         * @protected
         * @param {Object} attrs  An object with attributes name/value pairs.
         * @param {Object} opts  Properties to mix into the event payload. These are shared and mixed into each set
         * @return {Object} A reference to the host object.
         * @chainable
         */
        _setAttrs : function(attrs, opts) {
            var attr;
            for (attr in attrs) {
                if ( attrs.hasOwnProperty(attr) ) {
                    this.set(attr, attrs[attr], opts);
                }
            }
            return this;
        },

        /**
         * Utility method to help setup the event payload and fire the attribute change event.
         *
         * @method _fireAttrChange
         * @private
         * @param {String} attrName The name of the attribute
         * @param {String} subAttrName The full path of the property being changed,
         * if this is a sub-attribute value being change. Otherwise null.
         * @param {Any} currVal The current value of the attribute
         * @param {Any} newVal The new value of the attribute
         * @param {Object} opts Any additional event data to mix into the attribute change event's event facade.
         * @param {Object} [cfg] The attribute config stored in State, if already available.
         */
        _fireAttrChange : function(attrName, subAttrName, currVal, newVal, opts, cfg) {
            var host = this,
                eventName = this._getFullType(attrName + CHANGE),
                state = host._state,
                facade,
                broadcast,
                e;

            if (!cfg) {
                cfg = state.data[attrName] || {};
            }

            if (!cfg.published) {

                // PERF: Using lower level _publish() for
                // critical path performance
                e = host._publish(eventName);

                e.emitFacade = true;
                e.defaultTargetOnly = true;
                e.defaultFn = host._defAttrChangeFn;

                broadcast = cfg.broadcast;
                if (broadcast !== undefined) {
                    e.broadcast = broadcast;
                }

                cfg.published = true;
            }

            if (opts) {
                facade = Y.merge(opts);
                facade._attrOpts = opts;
            } else {
                facade = host._ATTR_E_FACADE;
            }

            // Not using the single object signature for fire({type:..., newVal:...}), since
            // we don't want to override type. Changed to the fire(type, {newVal:...}) signature.

            facade.attrName = attrName;
            facade.subAttrName = subAttrName;
            facade.prevVal = currVal;
            facade.newVal = newVal;

            if (host._hasPotentialSubscribers(eventName)) {
                host.fire(eventName, facade);
            } else {
                this._setAttrVal(attrName, subAttrName, currVal, newVal, opts, cfg);
            }
        },

        /**
         * Default function for attribute change events.
         *
         * @private
         * @method _defAttrChangeFn
         * @param {EventFacade} e The event object for attribute change events.
         * @param {boolean} eventFastPath Whether or not we're using this as a fast path in the case of no listeners or not
         */
        _defAttrChangeFn : function(e, eventFastPath) {

            var opts = e._attrOpts;
            if (opts) {
                delete e._attrOpts;
            }

            if (!this._setAttrVal(e.attrName, e.subAttrName, e.prevVal, e.newVal, opts)) {


                if (!eventFastPath) {
                    // Prevent "after" listeners from being invoked since nothing changed.
                    e.stopImmediatePropagation();
                }

            } else {
                if (!eventFastPath) {
                    e.newVal = this.get(e.attrName);
                }
            }
        }
    };

    // Basic prototype augment - no lazy constructor invocation.
    Y.mix(AttributeObservable, EventTarget, false, null, 1);

    Y.AttributeObservable = AttributeObservable;

    /**
    The `AttributeEvents` class extension was deprecated in YUI 3.8.0 and is now
    an alias for the `AttributeObservable` class extension. Use that class
    extnesion instead. This alias will be removed in a future version of YUI.

    @class AttributeEvents
    @uses EventTarget
    @deprecated Use `AttributeObservable` instead.
    @see AttributeObservable
    **/
    Y.AttributeEvents = AttributeObservable;


}, '3.17.1', {"requires": ["event-custom"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('attribute-extras', function (Y, NAME) {

    /**
     * The attribute module provides an augmentable Attribute implementation, which
     * adds configurable attributes and attribute change events to the class being
     * augmented. It also provides a State class, which is used internally by Attribute,
     * but can also be used independently to provide a name/property/value data structure to
     * store state.
     *
     * @module attribute
     */

    /**
     * The attribute-extras submodule provides less commonly used attribute methods, and can
     * be augmented/mixed into an implemention which used attribute-core.
     *
     * @module attribute
     * @submodule attribute-extras
     */
    var BROADCAST = "broadcast",
        PUBLISHED = "published",
        INIT_VALUE = "initValue",

        MODIFIABLE = {
            readOnly:1,
            writeOnce:1,
            getter:1,
            broadcast:1
        };

    /**
     * A augmentable implementation for AttributeCore, providing less frequently used
     * methods for Attribute management such as modifyAttrs(), removeAttr and reset()
     *
     * @class AttributeExtras
     * @extensionfor AttributeCore
     */
    function AttributeExtras() {}

    AttributeExtras.prototype = {

        /**
         * Updates the configuration of an attribute which has already been added.
         * <p>
         * The properties which can be modified through this interface are limited
         * to the following subset of attributes, which can be safely modified
         * after a value has already been set on the attribute:
         * </p>
         * <dl>
         *  <dt>readOnly;</dt>
         *  <dt>writeOnce;</dt>
         *  <dt>broadcast; and</dt>
         *  <dt>getter.</dt>
         * </dl>
         * <p>
         * Note: New attributes cannot be added using this interface. New attributes must be
         * added using {{#crossLink "AttributeCore/addAttr:method"}}addAttr{{/crossLink}}, or an
         * appropriate manner for a class which utilises Attributes (e.g. the
         * {{#crossLink "Base/ATTRS:property"}}ATTRS{{/crossLink}} property in
         * {{#crossLink "Base"}}Base{{/crossLink}}).
         * </p>
         * @method modifyAttr
         * @param {String} name The name of the attribute whose configuration is to be updated.
         * @param {Object} config An object with configuration property/value pairs, specifying the configuration properties to modify.
         */
        modifyAttr: function(name, config) {
            var host = this, // help compression
                prop, state;

            if (host.attrAdded(name)) {

                if (host._isLazyAttr(name)) {
                    host._addLazyAttr(name);
                }

                state = host._state;
                for (prop in config) {
                    if (MODIFIABLE[prop] && config.hasOwnProperty(prop)) {
                        state.add(name, prop, config[prop]);

                        // If we reconfigured broadcast, need to republish
                        if (prop === BROADCAST) {
                            state.remove(name, PUBLISHED);
                        }
                    }
                }
            } else {
            }
        },

        /**
         * Removes an attribute from the host object
         *
         * @method removeAttr
         * @param {String} name The name of the attribute to be removed.
         */
        removeAttr: function(name) {
            this._state.removeAll(name);
        },

        /**
         * Resets the attribute (or all attributes) to its initial value, as long as
         * the attribute is not readOnly, or writeOnce.
         *
         * @method reset
         * @param {String} name Optional. The name of the attribute to reset.  If omitted, all attributes are reset.
         * @return {Object} A reference to the host object.
         * @chainable
         */
        reset : function(name) {
            var host = this;  // help compression

            if (name) {
                if (host._isLazyAttr(name)) {
                    host._addLazyAttr(name);
                }
                host.set(name, host._state.get(name, INIT_VALUE));
            } else {
                Y.Object.each(host._state.data, function(v, n) {
                    host.reset(n);
                });
            }
            return host;
        },

        /**
         * Returns an object with the configuration properties (and value)
         * for the given attribute. If attrName is not provided, returns the
         * configuration properties for all attributes.
         *
         * @method _getAttrCfg
         * @protected
         * @param {String} name Optional. The attribute name. If not provided, the method will return the configuration for all attributes.
         * @return {Object} The configuration properties for the given attribute, or all attributes.
         */
        _getAttrCfg : function(name) {
            var o,
                state = this._state;

            if (name) {
                o = state.getAll(name) || {};
            } else {
                o = {};
                Y.each(state.data, function(v, n) {
                    o[n] = state.getAll(n);
                });
            }

            return o;
        }
    };

    Y.AttributeExtras = AttributeExtras;


}, '3.17.1', {"requires": ["oop"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('attribute-base', function (Y, NAME) {

    /**
     * The attribute module provides an augmentable Attribute implementation, which
     * adds configurable attributes and attribute change events to the class being
     * augmented. It also provides a State class, which is used internally by Attribute,
     * but can also be used independently to provide a name/property/value data structure to
     * store state.
     *
     * @module attribute
     */

    /**
     * The attribute-base submodule provides core attribute handling support, with everything
     * aside from complex attribute handling in the provider's constructor.
     *
     * @module attribute
     * @submodule attribute-base
     */

    /**
     * <p>
     * Attribute provides configurable attribute support along with attribute change events. It is designed to be
     * augmented on to a host class, and provides the host with the ability to configure attributes to store and retrieve state,
     * along with attribute change events.
     * </p>
     * <p>For example, attributes added to the host can be configured:</p>
     * <ul>
     *     <li>As read only.</li>
     *     <li>As write once.</li>
     *     <li>With a setter function, which can be used to manipulate
     *     values passed to Attribute's <a href="#method_set">set</a> method, before they are stored.</li>
     *     <li>With a getter function, which can be used to manipulate stored values,
     *     before they are returned by Attribute's <a href="#method_get">get</a> method.</li>
     *     <li>With a validator function, to validate values before they are stored.</li>
     * </ul>
     *
     * <p>See the <a href="#method_addAttr">addAttr</a> method, for the complete set of configuration
     * options available for attributes.</p>
     *
     * <p><strong>NOTE:</strong> Most implementations will be better off extending the <a href="Base.html">Base</a> class,
     * instead of augmenting Attribute directly. Base augments Attribute and will handle the initial configuration
     * of attributes for derived classes, accounting for values passed into the constructor.</p>
     *
     * @class Attribute
     * @param attrs {Object} The attributes to add during construction (passed through to <a href="#method_addAttrs">addAttrs</a>).
     *        These can also be defined on the constructor being augmented with Attribute by defining the ATTRS property on the constructor.
     * @param values {Object} The initial attribute values to apply (passed through to <a href="#method_addAttrs">addAttrs</a>).
     *        These are not merged/cloned. The caller is responsible for isolating user provided values if required.
     * @param lazy {boolean} Whether or not to add attributes lazily (passed through to <a href="#method_addAttrs">addAttrs</a>).
     * @uses AttributeCore
     * @uses AttributeObservable
     * @uses EventTarget
     * @uses AttributeExtras
     */
    function Attribute() {
        Y.AttributeCore.apply(this, arguments);
        Y.AttributeObservable.apply(this, arguments);
        Y.AttributeExtras.apply(this, arguments);
    }

    Y.mix(Attribute, Y.AttributeCore, false, null, 1);
    Y.mix(Attribute, Y.AttributeExtras, false, null, 1);

    // Needs to be `true`, to overwrite methods from AttributeCore
    Y.mix(Attribute, Y.AttributeObservable, true, null, 1);

    /**
     * <p>The value to return from an attribute setter in order to prevent the set from going through.</p>
     *
     * <p>You can return this value from your setter if you wish to combine validator and setter
     * functionality into a single setter function, which either returns the massaged value to be stored or
     * AttributeCore.INVALID_VALUE to prevent invalid values from being stored.</p>
     *
     * @property INVALID_VALUE
     * @type Object
     * @static
     * @final
     */
    Attribute.INVALID_VALUE = Y.AttributeCore.INVALID_VALUE;

    /**
     * The list of properties which can be configured for
     * each attribute (e.g. setter, getter, writeOnce etc.).
     *
     * This property is used internally as a whitelist for faster
     * Y.mix operations.
     *
     * @property _ATTR_CFG
     * @type Array
     * @static
     * @protected
     */
    Attribute._ATTR_CFG = Y.AttributeCore._ATTR_CFG.concat(Y.AttributeObservable._ATTR_CFG);

    /**
     * Utility method to protect an attribute configuration hash, by merging the
     * entire object and the individual attr config objects.
     *
     * @method protectAttrs
     * @static
     * @param {Object} attrs A hash of attribute to configuration object pairs.
     * @return {Object} A protected version of the `attrs` argument.
     */
    Attribute.protectAttrs = Y.AttributeCore.protectAttrs;

    Y.Attribute = Attribute;


}, '3.17.1', {"requires": ["attribute-core", "attribute-observable", "attribute-extras"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('attribute-complex', function (Y, NAME) {

    /**
     * Adds support for attribute providers to handle complex attributes in the constructor
     *
     * @module attribute
     * @submodule attribute-complex
     * @for Attribute
     * @deprecated AttributeComplex's overrides are now part of AttributeCore.
     */

    var Attribute = Y.Attribute;

    Attribute.Complex = function() {};
    Attribute.Complex.prototype = {

        /**
         * Utility method to split out simple attribute name/value pairs ("x")
         * from complex attribute name/value pairs ("x.y.z"), so that complex
         * attributes can be keyed by the top level attribute name.
         *
         * @method _normAttrVals
         * @param {Object} valueHash An object with attribute name/value pairs
         *
         * @return {Object} An object literal with 2 properties - "simple" and "complex",
         * containing simple and complex attribute values respectively keyed
         * by the top level attribute name, or null, if valueHash is falsey.
         *
         * @private
         */
        _normAttrVals : Attribute.prototype._normAttrVals,

        /**
         * Returns the initial value of the given attribute from
         * either the default configuration provided, or the
         * over-ridden value if it exists in the set of initValues
         * provided and the attribute is not read-only.
         *
         * @param {String} attr The name of the attribute
         * @param {Object} cfg The attribute configuration object
         * @param {Object} initValues The object with simple and complex attribute name/value pairs returned from _normAttrVals
         *
         * @return {Any} The initial value of the attribute.
         *
         * @method _getAttrInitVal
         * @private
         */
        _getAttrInitVal : Attribute.prototype._getAttrInitVal

    };

    // Consistency with the rest of the Attribute addons for now.
    Y.AttributeComplex = Attribute.Complex;


}, '3.17.1', {"requires": ["attribute-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('base-core', function (Y, NAME) {

    /**
     * The base module provides the Base class, which objects requiring attribute and custom event support can extend.
     * The module also provides two ways to reuse code - It augments Base with the Plugin.Host interface which provides
     * plugin support and also provides the BaseCore.build method which provides a way to build custom classes using extensions.
     *
     * @module base
     */

    /**
     * <p>The base-core module provides the BaseCore class, the lightest version of Base,
     * which provides Base's basic lifecycle management and ATTRS construction support,
     * but doesn't fire init/destroy or attribute change events.</p>
     *
     * <p>It mixes in AttributeCore, which is the lightest version of Attribute</p>
     *
     * @module base
     * @submodule base-core
     */
    var O = Y.Object,
        L = Y.Lang,
        DOT = ".",
        INITIALIZED = "initialized",
        DESTROYED = "destroyed",
        INITIALIZER = "initializer",
        VALUE = "value",
        OBJECT_CONSTRUCTOR = Object.prototype.constructor,
        DEEP = "deep",
        SHALLOW = "shallow",
        DESTRUCTOR = "destructor",

        AttributeCore = Y.AttributeCore,

        _wlmix = function(r, s, wlhash) {
            var p;
            for (p in s) {
                if(wlhash[p]) {
                    r[p] = s[p];
                }
            }
            return r;
        };

    /**
     * The BaseCore class, is the lightest version of Base, and provides Base's
     * basic lifecycle management and ATTRS construction support, but doesn't
     * fire init/destroy or attribute change events.
     *
     * BaseCore also handles the chaining of initializer and destructor methods across
     * the hierarchy as part of object construction and destruction. Additionally, attributes
     * configured through the static <a href="#property_BaseCore.ATTRS">ATTRS</a>
     * property for each class in the hierarchy will be initialized by BaseCore.
     *
     * Classes which require attribute support, but don't intend to use/expose attribute
     * change events can extend BaseCore instead of Base for optimal kweight and
     * runtime performance.
     *
     * **3.11.0 BACK COMPAT NOTE FOR COMPONENT DEVELOPERS**
     *
     * Prior to version 3.11.0, ATTRS would get added a class at a time. That is:
     *
     * <pre>
     *    for each (class in the hierarchy) {
     *       Call the class Extension constructors.
     *
     *       Add the class ATTRS.
     *
     *       Call the class initializer
     *       Call the class Extension initializers.
     *    }
     * </pre>
     *
     * As of 3.11.0, ATTRS from all classes in the hierarchy are added in one `addAttrs` call
     * before **any** initializers are called. That is, the flow becomes:
     *
     * <pre>
     *    for each (class in the hierarchy) {
     *       Call the class Extension constructors.
     *    }
     *
     *    Add ATTRS for all classes
     *
     *    for each (class in the hierarchy) {
     *       Call the class initializer.
     *       Call the class Extension initializers.
     *    }
     * </pre>
     *
     * Adding all ATTRS at once fixes subtle edge-case issues with subclass ATTRS overriding
     * superclass `setter`, `getter` or `valueFn` definitions and being unable to get/set attributes
     * defined by the subclass. It also leaves us with a cleaner order of operation flow moving
     * forward.
     *
     * However, it may require component developers to upgrade their components, for the following
     * scenarios:
     *
     * 1. It impacts components which may have `setter`, `getter` or `valueFn` code which
     * expects a superclass' initializer to have run.
     *
     * This is expected to be rare, but to support it, Base now supports a `_preAddAttrs()`, method
     * hook (same signature as `addAttrs`). Components can implement this method on their prototype
     * for edge cases which do require finer control over the order in which attributes are added
     * (see widget-htmlparser for example).
     *
     * 2. Extension developers may need to move code from Extension constructors to `initializer`s
     *
     * Older extensions, which were written before `initializer` support was added, had a lot of
     * initialization code in their constructors. For example, code which acccessed superclass
     * attributes. With the new flow this code would not be able to see attributes. The recommendation
     * is to move this initialization code to an `initializer` on the Extension, which was the
     * recommendation for anything created after `initializer` support for Extensions was added.
     *
     * @class BaseCore
     * @constructor
     * @uses AttributeCore
     * @param {Object} cfg Object with configuration property name/value pairs.
     * The object can be used to provide initial values for the objects published
     * attributes.
     */
    function BaseCore(cfg) {
        if (!this._BaseInvoked) {
            this._BaseInvoked = true;

            this._initBase(cfg);
        }
    }

    /**
     * The list of properties which can be configured for each attribute
     * (e.g. setter, getter, writeOnce, readOnly etc.)
     *
     * @property _ATTR_CFG
     * @type Array
     * @static
     * @private
     */
    BaseCore._ATTR_CFG = AttributeCore._ATTR_CFG.concat("cloneDefaultValue");

    /**
     * The array of non-attribute configuration properties supported by this class.
     *
     * For example `BaseCore` defines a "plugins" configuration property which
     * should not be set up as an attribute. This property is primarily required so
     * that when <a href="#property__allowAdHocAttrs">`_allowAdHocAttrs`</a> is enabled by a class,
     * non-attribute configuration properties don't get added as ad-hoc attributes.
     *
     * @property _NON_ATTRS_CFG
     * @type Array
     * @static
     * @private
     */
    BaseCore._NON_ATTRS_CFG = ["plugins"];

    /**
     * This property controls whether or not instances of this class should
     * allow users to add ad-hoc attributes through the constructor configuration
     * hash.
     *
     * AdHoc attributes are attributes which are not defined by the class, and are
     * not handled by the MyClass._NON_ATTRS_CFG
     *
     * @property _allowAdHocAttrs
     * @type boolean
     * @default undefined (false)
     * @protected
     */

    /**
     * The string to be used to identify instances of this class.
     *
     * Classes extending BaseCore, should define their own
     * static NAME property, which should be camelCase by
     * convention (e.g. MyClass.NAME = "myClass";).
     *
     * @property NAME
     * @type String
     * @static
     */
    BaseCore.NAME = "baseCore";

    /**
     * The default set of attributes which will be available for instances of this class, and
     * their configuration. In addition to the configuration properties listed by
     * AttributeCore's <a href="AttributeCore.html#method_addAttr">addAttr</a> method,
     * the attribute can also be configured with a "cloneDefaultValue" property, which
     * defines how the statically defined value field should be protected
     * ("shallow", "deep" and false are supported values).
     *
     * By default if the value is an object literal or an array it will be "shallow"
     * cloned, to protect the default value.
     *
     * @property ATTRS
     * @type Object
     * @static
     */
    BaseCore.ATTRS = {
        /**
         * Flag indicating whether or not this object
         * has been through the init lifecycle phase.
         *
         * @attribute initialized
         * @readonly
         * @default false
         * @type boolean
         */
        initialized: {
            readOnly:true,
            value:false
        },

        /**
         * Flag indicating whether or not this object
         * has been through the destroy lifecycle phase.
         *
         * @attribute destroyed
         * @readonly
         * @default false
         * @type boolean
         */
        destroyed: {
            readOnly:true,
            value:false
        }
    };

    /**
    Provides a way to safely modify a `Y.BaseCore` subclass' static `ATTRS`
    after the class has been defined or created.

    BaseCore-based classes cache information about the class hierarchy in order
    to efficiently create instances. This cache includes includes the aggregated
    `ATTRS` configs. If the static `ATTRS` configs need to be modified after the
    class has been defined or create, then use this method which will make sure
    to clear any cached data before making any modifications.

    @method modifyAttrs
    @param {Function} [ctor] The constructor function whose `ATTRS` should be
        modified. If a `ctor` function is not specified, then `this` is assumed
        to be the constructor which hosts the `ATTRS`.
    @param {Object} configs The collection of `ATTRS` configs to mix with the
        existing attribute configurations.
    @static
    @since 3.10.0
    **/
    BaseCore.modifyAttrs = function (ctor, configs) {
        // When called without a constructor, assume `this` is the constructor.
        if (typeof ctor !== 'function') {
            configs = ctor;
            ctor    = this;
        }

        var attrs, attr, name;

        // Eagerly create the `ATTRS` object if it doesn't already exist.
        attrs = ctor.ATTRS || (ctor.ATTRS = {});

        if (configs) {
            // Clear cache because it has ATTRS aggregation data which is about
            // to be modified.
            ctor._CACHED_CLASS_DATA = null;

            for (name in configs) {
                if (configs.hasOwnProperty(name)) {
                    attr = attrs[name] || (attrs[name] = {});
                    Y.mix(attr, configs[name], true);
                }
            }
        }
    };

    BaseCore.prototype = {

        /**
         * Internal construction logic for BaseCore.
         *
         * @method _initBase
         * @param {Object} config The constructor configuration object
         * @private
         */
        _initBase : function(config) {

            Y.stamp(this);

            this._initAttribute(config);

            // If Plugin.Host has been augmented [ through base-pluginhost ], setup it's
            // initial state, but don't initialize Plugins yet. That's done after initialization.
            var PluginHost = Y.Plugin && Y.Plugin.Host;
            if (this._initPlugins && PluginHost) {
                PluginHost.call(this);
            }

            if (this._lazyAddAttrs !== false) { this._lazyAddAttrs = true; }

            /**
             * The string used to identify the class of this object.
             *
             * @deprecated Use this.constructor.NAME
             * @property name
             * @type String
             */
            this.name = this.constructor.NAME;

            this.init.apply(this, arguments);
        },

        /**
         * Initializes AttributeCore
         *
         * @method _initAttribute
         * @private
         */
        _initAttribute: function() {
            AttributeCore.call(this);
        },

        /**
         * Init lifecycle method, invoked during construction. Sets up attributes
         * and invokes initializers for the class hierarchy.
         *
         * @method init
         * @chainable
         * @param {Object} cfg Object with configuration property name/value pairs
         * @return {BaseCore} A reference to this object
         */
        init: function(cfg) {

            this._baseInit(cfg);

            return this;
        },

        /**
         * Internal initialization implementation for BaseCore
         *
         * @method _baseInit
         * @private
         */
        _baseInit: function(cfg) {
            this._initHierarchy(cfg);

            if (this._initPlugins) {
                // Need to initPlugins manually, to handle constructor parsing, static Plug parsing
                this._initPlugins(cfg);
            }
            this._set(INITIALIZED, true);
        },

        /**
         * Destroy lifecycle method. Invokes destructors for the class hierarchy.
         *
         * @method destroy
         * @return {BaseCore} A reference to this object
         * @chainable
         */
        destroy: function() {
            this._baseDestroy();
            return this;
        },

        /**
         * Internal destroy implementation for BaseCore
         *
         * @method _baseDestroy
         * @private
         */
        _baseDestroy : function() {
            if (this._destroyPlugins) {
                this._destroyPlugins();
            }
            this._destroyHierarchy();
            this._set(DESTROYED, true);
        },

        /**
         * Returns the class hierarchy for this object, with BaseCore being the last class in the array.
         *
         * @method _getClasses
         * @protected
         * @return {Function[]} An array of classes (constructor functions), making up the class hierarchy for this object.
         * This value is cached the first time the method, or _getAttrCfgs, is invoked. Subsequent invocations return the
         * cached value.
         */
        _getClasses : function() {
            if (!this._classes) {
                this._initHierarchyData();
            }
            return this._classes;
        },

        /**
         * Returns an aggregated set of attribute configurations, by traversing
         * the class hierarchy.
         *
         * @method _getAttrCfgs
         * @protected
         * @return {Object} The hash of attribute configurations, aggregated across classes in the hierarchy
         * This value is cached the first time the method, or _getClasses, is invoked. Subsequent invocations return
         * the cached value.
         */
        _getAttrCfgs : function() {
            if (!this._attrs) {
                this._initHierarchyData();
            }
            return this._attrs;
        },

        /**
         * A helper method used to isolate the attrs config for this instance to pass to `addAttrs`,
         * from the static cached ATTRS for the class.
         *
         * @method _getInstanceAttrCfgs
         * @private
         *
         * @param {Object} allCfgs The set of all attribute configurations for this instance.
         * Attributes will be removed from this set, if they belong to the filtered class, so
         * that by the time all classes are processed, allCfgs will be empty.
         *
         * @return {Object} The set of attributes to be added for this instance, suitable
         * for passing through to `addAttrs`.
         */
        _getInstanceAttrCfgs : function(allCfgs) {

            var cfgs = {},
                cfg,
                val,
                subAttr,
                subAttrs,
                subAttrPath,
                attr,
                attrCfg,
                allSubAttrs = allCfgs._subAttrs,
                attrCfgProperties = this._attrCfgHash();

            for (attr in allCfgs) {

                if (allCfgs.hasOwnProperty(attr) && attr !== "_subAttrs") {

                    attrCfg = allCfgs[attr];

                    // Need to isolate from allCfgs, because we're going to set values etc.
                    cfg = cfgs[attr] = _wlmix({}, attrCfg, attrCfgProperties);

                    val = cfg.value;

                    if (val && (typeof val === "object")) {
                        this._cloneDefaultValue(attr, cfg);
                    }

                    if (allSubAttrs && allSubAttrs.hasOwnProperty(attr)) {
                        subAttrs = allCfgs._subAttrs[attr];

                        for (subAttrPath in subAttrs) {
                            subAttr = subAttrs[subAttrPath];

                            if (subAttr.path) {
                                O.setValue(cfg.value, subAttr.path, subAttr.value);
                            }
                        }
                    }
                }
            }

            return cfgs;
        },

        /**
         * @method _filterAdHocAttrs
         * @private
         *
         * @param {Object} allAttrs The set of all attribute configurations for this instance.
         * Attributes will be removed from this set, if they belong to the filtered class, so
         * that by the time all classes are processed, allCfgs will be empty.
         * @param {Object} userVals The config object passed in by the user, from which adhoc attrs are to be filtered.
         * @return {Object} The set of adhoc attributes passed in, in the form
         * of an object with attribute name/configuration pairs.
         */
        _filterAdHocAttrs : function(allAttrs, userVals) {
            var adHocs,
                nonAttrs = this._nonAttrs,
                attr;

            if (userVals) {
                adHocs = {};
                for (attr in userVals) {
                    if (!allAttrs[attr] && !nonAttrs[attr] && userVals.hasOwnProperty(attr)) {
                        adHocs[attr] = {
                            value:userVals[attr]
                        };
                    }
                }
            }

            return adHocs;
        },

        /**
         * A helper method used by _getClasses and _getAttrCfgs, which determines both
         * the array of classes and aggregate set of attribute configurations
         * across the class hierarchy for the instance.
         *
         * @method _initHierarchyData
         * @private
         */
        _initHierarchyData : function() {

            var ctor = this.constructor,
                cachedClassData = ctor._CACHED_CLASS_DATA,
                c,
                i,
                l,
                attrCfg,
                attrCfgHash,
                needsAttrCfgHash = !ctor._ATTR_CFG_HASH,
                nonAttrsCfg,
                nonAttrs = {},
                classes = [],
                attrs = [];

            // Start with `this` instance's constructor.
            c = ctor;

            if (!cachedClassData) {

                while (c) {
                    // Add to classes
                    classes[classes.length] = c;

                    // Add to attributes
                    if (c.ATTRS) {
                        attrs[attrs.length] = c.ATTRS;
                    }

                    // Aggregate ATTR cfg whitelist.
                    if (needsAttrCfgHash) {
                        attrCfg     = c._ATTR_CFG;
                        attrCfgHash = attrCfgHash || {};

                        if (attrCfg) {
                            for (i = 0, l = attrCfg.length; i < l; i += 1) {
                                attrCfgHash[attrCfg[i]] = true;
                            }
                        }
                    }

                    // Commenting out the if. We always aggregate, since we don't
                    // know if we'll be needing this on the instance or not.
                    // if (this._allowAdHocAttrs) {
                        nonAttrsCfg = c._NON_ATTRS_CFG;
                        if (nonAttrsCfg) {
                            for (i = 0, l = nonAttrsCfg.length; i < l; i++) {
                                nonAttrs[nonAttrsCfg[i]] = true;
                            }
                        }
                    //}

                    c = c.superclass ? c.superclass.constructor : null;
                }

                // Cache computed `_ATTR_CFG_HASH` on the constructor.
                if (needsAttrCfgHash) {
                    ctor._ATTR_CFG_HASH = attrCfgHash;
                }

                cachedClassData = ctor._CACHED_CLASS_DATA = {
                    classes : classes,
                    nonAttrs : nonAttrs,
                    attrs : this._aggregateAttrs(attrs)
                };

            }

            this._classes = cachedClassData.classes;
            this._attrs = cachedClassData.attrs;
            this._nonAttrs = cachedClassData.nonAttrs;
        },

        /**
         * Utility method to define the attribute hash used to filter/whitelist property mixes for
         * this class for iteration performance reasons.
         *
         * @method _attrCfgHash
         * @private
         */
        _attrCfgHash: function() {
            return this.constructor._ATTR_CFG_HASH;
        },

        /**
         * This method assumes that the value has already been checked to be an object.
         * Since it's on a critical path, we don't want to re-do the check.
         *
         * @method _cloneDefaultValue
         * @param {Object} cfg
         * @private
         */
        _cloneDefaultValue : function(attr, cfg) {

            var val = cfg.value,
                clone = cfg.cloneDefaultValue;

            if (clone === DEEP || clone === true) {
                cfg.value = Y.clone(val);
            } else if (clone === SHALLOW) {
                cfg.value = Y.merge(val);
            } else if ((clone === undefined && (OBJECT_CONSTRUCTOR === val.constructor || L.isArray(val)))) {
                cfg.value = Y.clone(val);
            }
            // else if (clone === false), don't clone the static default value.
            // It's intended to be used by reference.
        },

        /**
         * A helper method, used by _initHierarchyData to aggregate
         * attribute configuration across the instances class hierarchy.
         *
         * The method will protect the attribute configuration value to protect the statically defined
         * default value in ATTRS if required (if the value is an object literal, array or the
         * attribute configuration has cloneDefaultValue set to shallow or deep).
         *
         * @method _aggregateAttrs
         * @private
         * @param {Array} allAttrs An array of ATTRS definitions across classes in the hierarchy
         * (subclass first, Base last)
         * @return {Object} The aggregate set of ATTRS definitions for the instance
         */
        _aggregateAttrs : function(allAttrs) {

            var attr,
                attrs,
                subAttrsHash,
                cfg,
                path,
                i,
                cfgPropsHash = this._attrCfgHash(),
                aggAttr,
                aggAttrs = {};

            if (allAttrs) {
                for (i = allAttrs.length-1; i >= 0; --i) {

                    attrs = allAttrs[i];

                    for (attr in attrs) {
                        if (attrs.hasOwnProperty(attr)) {

                            // PERF TODO: Do we need to merge here, since we're merging later in getInstanceAttrCfgs
                            // Should we move this down to only merge if we hit the path or valueFn ifs below?
                            cfg = _wlmix({}, attrs[attr], cfgPropsHash);

                            path = null;
                            if (attr.indexOf(DOT) !== -1) {
                                path = attr.split(DOT);
                                attr = path.shift();
                            }

                            aggAttr = aggAttrs[attr];

                            if (path && aggAttr && aggAttr.value) {

                                subAttrsHash = aggAttrs._subAttrs;

                                if (!subAttrsHash) {
                                    subAttrsHash = aggAttrs._subAttrs = {};
                                }

                                if (!subAttrsHash[attr]) {
                                    subAttrsHash[attr] = {};
                                }

                                subAttrsHash[attr][path.join(DOT)] = {
                                    value: cfg.value,
                                    path : path
                                };

                            } else if (!path) {

                                if (!aggAttr) {
                                    aggAttrs[attr] = cfg;
                                } else {
                                    if (aggAttr.valueFn && VALUE in cfg) {
                                        aggAttr.valueFn = null;
                                    }

                                    // Mix into existing config.
                                    _wlmix(aggAttr, cfg, cfgPropsHash);
                                }
                            }
                        }
                    }
                }
            }

            return aggAttrs;
        },

        /**
         * Initializes the class hierarchy for the instance, which includes
         * initializing attributes for each class defined in the class's
         * static <a href="#property_BaseCore.ATTRS">ATTRS</a> property and
         * invoking the initializer method on the prototype of each class in the hierarchy.
         *
         * @method _initHierarchy
         * @param {Object} userVals Object with configuration property name/value pairs
         * @private
         */
        _initHierarchy : function(userVals) {

            var lazy = this._lazyAddAttrs,
                constr,
                constrProto,
                i,
                l,
                ci,
                ei,
                el,
                ext,
                extProto,
                exts,
                instanceAttrs,
                initializers = [],
                classes = this._getClasses(),
                attrCfgs = this._getAttrCfgs(),
                cl = classes.length - 1;

            // Constructors
            for (ci = cl; ci >= 0; ci--) {

                constr = classes[ci];
                constrProto = constr.prototype;
                exts = constr._yuibuild && constr._yuibuild.exts;

                // Using INITIALIZER in hasOwnProperty check, for performance reasons (helps IE6 avoid GC thresholds when
                // referencing string literals). Not using it in apply, again, for performance "." is faster.

                if (constrProto.hasOwnProperty(INITIALIZER)) {
                    // Store initializer while we're here and looping
                    initializers[initializers.length] = constrProto.initializer;
                }

                if (exts) {
                    for (ei = 0, el = exts.length; ei < el; ei++) {

                        ext = exts[ei];

                        // Ext Constructor
                        ext.apply(this, arguments);

                        extProto = ext.prototype;
                        if (extProto.hasOwnProperty(INITIALIZER)) {
                            // Store initializer while we're here and looping
                            initializers[initializers.length] = extProto.initializer;
                        }
                    }
                }
            }

            // ATTRS
            instanceAttrs = this._getInstanceAttrCfgs(attrCfgs);

            if (this._preAddAttrs) {
                this._preAddAttrs(instanceAttrs, userVals, lazy);
            }

            if (this._allowAdHocAttrs) {
                this.addAttrs(this._filterAdHocAttrs(attrCfgs, userVals), userVals, lazy);
            }

            this.addAttrs(instanceAttrs, userVals, lazy);

            // Initializers
            for (i = 0, l = initializers.length; i < l; i++) {
                initializers[i].apply(this, arguments);
            }
        },

        /**
         * Destroys the class hierarchy for this instance by invoking
         * the destructor method on the prototype of each class in the hierarchy.
         *
         * @method _destroyHierarchy
         * @private
         */
        _destroyHierarchy : function() {
            var constr,
                constrProto,
                ci, cl, ei, el, exts, extProto,
                classes = this._getClasses();

            for (ci = 0, cl = classes.length; ci < cl; ci++) {
                constr = classes[ci];
                constrProto = constr.prototype;
                exts = constr._yuibuild && constr._yuibuild.exts;

                if (exts) {
                    for (ei = 0, el = exts.length; ei < el; ei++) {
                        extProto = exts[ei].prototype;
                        if (extProto.hasOwnProperty(DESTRUCTOR)) {
                            extProto.destructor.apply(this, arguments);
                        }
                    }
                }

                if (constrProto.hasOwnProperty(DESTRUCTOR)) {
                    constrProto.destructor.apply(this, arguments);
                }
            }
        },

        /**
         * Default toString implementation. Provides the constructor NAME
         * and the instance guid, if set.
         *
         * @method toString
         * @return {String} String representation for this object
         */
        toString: function() {
            return this.name + "[" + Y.stamp(this, true) + "]";
        }
    };

    // Straightup augment, no wrapper functions
    Y.mix(BaseCore, AttributeCore, false, null, 1);

    // Fix constructor
    BaseCore.prototype.constructor = BaseCore;

    Y.BaseCore = BaseCore;


}, '3.17.1', {"requires": ["attribute-core"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('base-observable', function (Y, NAME) {

    /**
    The `base-observable` submodule adds observability to Base's lifecycle and
    attributes, and also make it an `EventTarget`.

    @module base
    @submodule base-observable
    **/
    var L = Y.Lang,

        DESTROY = "destroy",
        INIT = "init",

        BUBBLETARGETS = "bubbleTargets",
        _BUBBLETARGETS = "_bubbleTargets",

        AttributeObservable = Y.AttributeObservable,
        BaseCore            = Y.BaseCore;

    /**
    Provides an augmentable implementation of lifecycle and attribute events for
    `BaseCore`.

    @class BaseObservable
    @extensionfor BaseCore
    @uses AttributeObservable
    @uses EventTarget
    @since 3.8.0
    **/
    function BaseObservable() {}

    BaseObservable._ATTR_CFG      = AttributeObservable._ATTR_CFG.concat();
    BaseObservable._NON_ATTRS_CFG = ["on", "after", "bubbleTargets"];

    BaseObservable.prototype = {

        /**
         * Initializes Attribute
         *
         * @method _initAttribute
         * @private
         */
        _initAttribute: function() {
            BaseCore.prototype._initAttribute.apply(this, arguments);
            AttributeObservable.call(this);

            this._eventPrefix = this.constructor.EVENT_PREFIX || this.constructor.NAME;
            this._yuievt.config.prefix = this._eventPrefix;
        },

        /**
         * Init lifecycle method, invoked during construction.
         * Fires the init event prior to setting up attributes and
         * invoking initializers for the class hierarchy.
         *
         * @method init
         * @chainable
         * @param {Object} config Object with configuration property name/value pairs
         * @return {Base} A reference to this object
         */
        init: function(config) {

            /**
             * <p>
             * Lifecycle event for the init phase, fired prior to initialization.
             * Invoking the preventDefault() method on the event object provided
             * to subscribers will prevent initialization from occuring.
             * </p>
             * <p>
             * Subscribers to the "after" momemt of this event, will be notified
             * after initialization of the object is complete (and therefore
             * cannot prevent initialization).
             * </p>
             *
             * @event init
             * @preventable _defInitFn
             * @param {EventFacade} e Event object, with a cfg property which
             * refers to the configuration object passed to the constructor.
             */

            // PERF: Using lower level _publish() for
            // critical path performance

            var type = this._getFullType(INIT),
                e = this._publish(type);

            e.emitFacade = true;
            e.fireOnce = true;
            e.defaultTargetOnly = true;
            e.defaultFn = this._defInitFn;

            this._preInitEventCfg(config);

            if (e._hasPotentialSubscribers()) {
                this.fire(type, {cfg: config});
            } else {

                this._baseInit(config);

                // HACK. Major hack actually. But really fast for no-listeners.
                // Since it's fireOnce, subscribers may come along later, so since we're
                // bypassing the event stack the first time, we need to tell the published
                // event that it's been "fired". Could extract it into a CE method?
                e.fired = true;
                e.firedWith = [{cfg:config}];
            }

            return this;
        },

        /**
         * Handles the special on, after and target properties which allow the user to
         * easily configure on and after listeners as well as bubble targets during
         * construction, prior to init.
         *
         * @private
         * @method _preInitEventCfg
         * @param {Object} config The user configuration object
         */
        _preInitEventCfg : function(config) {
            if (config) {
                if (config.on) {
                    this.on(config.on);
                }
                if (config.after) {
                    this.after(config.after);
                }
            }

            var i, l, target,
                userTargets = (config && BUBBLETARGETS in config);

            if (userTargets || _BUBBLETARGETS in this) {
                target = userTargets ? (config && config.bubbleTargets) : this._bubbleTargets;

                if (L.isArray(target)) {
                    for (i = 0, l = target.length; i < l; i++) {
                        this.addTarget(target[i]);
                    }
                } else if (target) {
                    this.addTarget(target);
                }
            }
        },

        /**
         * <p>
         * Destroy lifecycle method. Fires the destroy
         * event, prior to invoking destructors for the
         * class hierarchy.
         * </p>
         * <p>
         * Subscribers to the destroy
         * event can invoke preventDefault on the event object, to prevent destruction
         * from proceeding.
         * </p>
         * @method destroy
         * @return {Base} A reference to this object
         * @chainable
         */
        destroy: function() {

            /**
             * <p>
             * Lifecycle event for the destroy phase,
             * fired prior to destruction. Invoking the preventDefault
             * method on the event object provided to subscribers will
             * prevent destruction from proceeding.
             * </p>
             * <p>
             * Subscribers to the "after" moment of this event, will be notified
             * after destruction is complete (and as a result cannot prevent
             * destruction).
             * </p>
             * @event destroy
             * @preventable _defDestroyFn
             * @param {EventFacade} e Event object
             */
            this.publish(DESTROY, {
                fireOnce:true,
                defaultTargetOnly:true,
                defaultFn: this._defDestroyFn
            });
            this.fire(DESTROY);

            this.detachAll();
            return this;
        },

        /**
         * Default init event handler
         *
         * @method _defInitFn
         * @param {EventFacade} e Event object, with a cfg property which
         * refers to the configuration object passed to the constructor.
         * @protected
         */
        _defInitFn : function(e) {
            this._baseInit(e.cfg);
        },

        /**
         * Default destroy event handler
         *
         * @method _defDestroyFn
         * @param {EventFacade} e Event object
         * @protected
         */
        _defDestroyFn : function(e) {
            this._baseDestroy(e.cfg);
        }
    };

    Y.mix(BaseObservable, AttributeObservable, false, null, 1);

    Y.BaseObservable = BaseObservable;


}, '3.17.1', {"requires": ["attribute-observable", "base-core"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('base-base', function (Y, NAME) {

    /**
     * The base module provides the Base class, which objects requiring attribute and custom event support can extend.
     * The module also provides two ways to reuse code - It augments Base with the Plugin.Host interface which provides
     * plugin support and also provides the BaseCore.build method which provides a way to build custom classes using extensions.
     *
     * @module base
     */

    /**
     * The base-base submodule provides the Base class without the Plugin support, provided by Plugin.Host,
     * and without the extension support provided by BaseCore.build.
     *
     * @module base
     * @submodule base-base
     */

    var AttributeCore   = Y.AttributeCore,
        AttributeExtras = Y.AttributeExtras,
        BaseCore        = Y.BaseCore,
        BaseObservable  = Y.BaseObservable;

    /**
     * <p>
     * A base class which objects requiring attributes and custom event support can
     * extend. Base also handles the chaining of initializer and destructor methods across
     * the hierarchy as part of object construction and destruction. Additionally, attributes configured
     * through the static <a href="#property_ATTRS">ATTRS</a> property for each class
     * in the hierarchy will be initialized by Base.
     * </p>
     *
     * <p>
     * **NOTE:** Prior to version 3.11.0, ATTRS would get added a class at a time. That is,
     * Base would loop through each class in the hierarchy, and add the class' ATTRS, and
     * then call it's initializer, and move on to the subclass' ATTRS and initializer. As of
     * 3.11.0, ATTRS from all classes in the hierarchy are added in one `addAttrs` call before
     * any initializers are called. This fixes subtle edge-case issues with subclass ATTRS overriding
     * superclass `setter`, `getter` or `valueFn` definitions and being unable to get/set attributes
     * defined by the subclass. This order of operation change may impact `setter`, `getter` or `valueFn`
     * code which expects a superclass' initializer to have run. This is expected to be rare, but to support
     * it, Base supports a `_preAddAttrs()`, method hook (same signature as `addAttrs`). Components can
     * implement this method on their prototype for edge cases which do require finer control over
     * the order in which attributes are added (see widget-htmlparser).
     * </p>
     *
     * <p>
     * The static <a href="#property_NAME">NAME</a> property of each class extending
     * from Base will be used as the identifier for the class, and is used by Base to prefix
     * all events fired by instances of that class.
     * </p>
     *
     * @class Base
     * @constructor
     * @uses BaseCore
     * @uses BaseObservable
     * @uses AttributeCore
     * @uses AttributeObservable
     * @uses AttributeExtras
     * @uses EventTarget
     *
     * @param {Object} config Object with configuration property name/value pairs. The object can be
     * used to provide default values for the objects published attributes.
     *
     * <p>
     * The config object can also contain the following non-attribute properties, providing a convenient
     * way to configure events listeners and plugins for the instance, as part of the constructor call:
     * </p>
     *
     * <dl>
     *   <dt>on</dt>
     *   <dd>An event name to listener function map, to register event listeners for the "on" moment of the event.
     *       A constructor convenience property for the <a href="Base.html#method_on">on</a> method.</dd>
     *   <dt>after</dt>
     *   <dd>An event name to listener function map, to register event listeners for the "after" moment of the event.
     *       A constructor convenience property for the <a href="Base.html#method_after">after</a> method.</dd>
     *   <dt>bubbleTargets</dt>
     *   <dd>An object, or array of objects, to register as bubble targets for bubbled events fired by this instance.
     *       A constructor convenience property for the <a href="EventTarget.html#method_addTarget">addTarget</a> method.</dd>
     *   <dt>plugins</dt>
     *   <dd>A plugin, or array of plugins to be plugged into the instance (see PluginHost's plug method for signature details).
     *       A constructor convenience property for the <a href="Plugin.Host.html#method_plug">plug</a> method.</dd>
     * </dl>
     */
    function Base() {
        BaseCore.apply(this, arguments);
        BaseObservable.apply(this, arguments);
        AttributeExtras.apply(this, arguments);
    }

    /**
     * The list of properties which can be configured for
     * each attribute (e.g. setter, getter, writeOnce, readOnly etc.)
     *
     * @property _ATTR_CFG
     * @type Array
     * @static
     * @private
     */
    Base._ATTR_CFG = BaseCore._ATTR_CFG.concat(BaseObservable._ATTR_CFG);

    /**
     * The array of non-attribute configuration properties supported by this class.
     *
     * `Base` supports "on", "after", "plugins" and "bubbleTargets" properties,
     * which are not set up as attributes.
     *
     * This property is primarily required so that when
     * <a href="#property__allowAdHocAttrs">`_allowAdHocAttrs`</a> is enabled by
     * a class, non-attribute configurations don't get added as ad-hoc attributes.
     *
     * @property _NON_ATTRS_CFG
     * @type Array
     * @static
     * @private
     */
    Base._NON_ATTRS_CFG = BaseCore._NON_ATTRS_CFG.concat(BaseObservable._NON_ATTRS_CFG);

    /**
     * <p>
     * The string to be used to identify instances of
     * this class, for example in prefixing events.
     * </p>
     * <p>
     * Classes extending Base, should define their own
     * static NAME property, which should be camelCase by
     * convention (e.g. MyClass.NAME = "myClass";).
     * </p>
     * @property NAME
     * @type String
     * @static
     */
    Base.NAME = 'base';

    /**
     * The default set of attributes which will be available for instances of this class, and
     * their configuration. In addition to the configuration properties listed by
     * Attribute's <a href="Attribute.html#method_addAttr">addAttr</a> method, the attribute
     * can also be configured with a "cloneDefaultValue" property, which defines how the statically
     * defined value field should be protected ("shallow", "deep" and false are supported values).
     *
     * By default if the value is an object literal or an array it will be "shallow" cloned, to
     * protect the default value.
     *
     * @property ATTRS
     * @type Object
     * @static
     */
    Base.ATTRS = AttributeCore.protectAttrs(BaseCore.ATTRS);

    /**
    Provides a way to safely modify a `Y.Base` subclass' static `ATTRS` after
    the class has been defined or created.

    Base-based classes cache information about the class hierarchy in order to
    efficiently create instances. This cache includes includes the aggregated
    `ATTRS` configs. If the static `ATTRS` configs need to be modified after the
    class has been defined or create, then use this method which will make sure
    to clear any cached data before making any modifications.

    @method modifyAttrs
    @param {Function} [ctor] The constructor function whose `ATTRS` should be
        modified. If a `ctor` function is not specified, then `this` is assumed
        to be the constructor which hosts the `ATTRS`.
    @param {Object} configs The collection of `ATTRS` configs to mix with the
        existing attribute configurations.
    @static
    @since 3.10.0
    **/
    Base.modifyAttrs = BaseCore.modifyAttrs;

    Y.mix(Base, BaseCore, false, null, 1);
    Y.mix(Base, AttributeExtras, false, null, 1);

    // Needs to be `true`, to overwrite methods from `BaseCore`.
    Y.mix(Base, BaseObservable, true, null, 1);

    // Fix constructor
    Base.prototype.constructor = Base;

    Y.Base = Base;


}, '3.17.1', {"requires": ["attribute-base", "base-core", "base-observable"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('base-pluginhost', function (Y, NAME) {

    /**
     * The base-pluginhost submodule adds Plugin support to Base, by augmenting Base with
     * Plugin.Host and setting up static (class level) Base.plug and Base.unplug methods.
     *
     * @module base
     * @submodule base-pluginhost
     * @for Base
     */

    var Base = Y.Base,
        PluginHost = Y.Plugin.Host;

    Y.mix(Base, PluginHost, false, null, 1);

    /**
     * Alias for <a href="Plugin.Host.html#method_Plugin.Host.plug">Plugin.Host.plug</a>. See aliased
     * method for argument and return value details.
     *
     * @method plug
     * @static
     */
    Base.plug = PluginHost.plug;

    /**
     * Alias for <a href="Plugin.Host.html#method_Plugin.Host.unplug">Plugin.Host.unplug</a>. See the
     * aliased method for argument and return value details.
     *
     * @method unplug
     * @static
     */
    Base.unplug = PluginHost.unplug;


}, '3.17.1', {"requires": ["base-base", "pluginhost"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('classnamemanager', function (Y, NAME) {

/**
* Contains a singleton (ClassNameManager) that enables easy creation and caching of
* prefixed class names.
* @module classnamemanager
*/

/**
 * A singleton class providing:
 *
 * <ul>
 *    <li>Easy creation of prefixed class names</li>
 *    <li>Caching of previously created class names for improved performance.</li>
 * </ul>
 *
 * @class ClassNameManager
 * @static
 */

// String constants
var CLASS_NAME_PREFIX = 'classNamePrefix',
	CLASS_NAME_DELIMITER = 'classNameDelimiter',
    CONFIG = Y.config;

// Global config

/**
 * Configuration property indicating the prefix for all CSS class names in this YUI instance.
 *
 * @property classNamePrefix
 * @type {String}
 * @default "yui"
 * @static
 */
CONFIG[CLASS_NAME_PREFIX] = CONFIG[CLASS_NAME_PREFIX] || 'yui3';

/**
 * Configuration property indicating the delimiter used to compose all CSS class names in
 * this YUI instance.
 *
 * @property classNameDelimiter
 * @type {String}
 * @default "-"
 * @static
 */
CONFIG[CLASS_NAME_DELIMITER] = CONFIG[CLASS_NAME_DELIMITER] || '-';

Y.ClassNameManager = function () {

	var sPrefix    = CONFIG[CLASS_NAME_PREFIX],
		sDelimiter = CONFIG[CLASS_NAME_DELIMITER];

	return {

		/**
		 * Returns a class name prefixed with the value of the
		 * <code>Y.config.classNamePrefix</code> attribute + the provided strings.
		 * Uses the <code>Y.config.classNameDelimiter</code> attribute to delimit the
		 * provided strings. E.g. Y.ClassNameManager.getClassName('foo','bar'); // yui-foo-bar
		 *
		 * @method getClassName
		 * @param {String} [classnameSection*] one or more classname sections to be joined
		 * @param {Boolean} skipPrefix If set to true, the classname will not be prefixed with the default Y.config.classNameDelimiter value.
		 */
		getClassName: Y.cached(function () {

            var args = Y.Array(arguments);

            if (args[args.length-1] !== true) {
                args.unshift(sPrefix);
            } else {
                args.pop();
            }

			return args.join(sDelimiter);
		})

	};

}();


}, '3.17.1', {"requires": ["yui-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-base', function (Y, NAME) {

/**
 * Provides the base Widget class, with HTML Parser support
 *
 * @module widget
 * @main widget
 */

/**
 * Provides the base Widget class
 *
 * @module widget
 * @submodule widget-base
 */
var L = Y.Lang,
    Node = Y.Node,

    ClassNameManager = Y.ClassNameManager,

    _getClassName = ClassNameManager.getClassName,
    _getWidgetClassName,

    _toInitialCap = Y.cached(function(str) {
        return str.substring(0, 1).toUpperCase() + str.substring(1);
    }),

    // K-Weight, IE GC optimizations
    CONTENT = "content",
    VISIBLE = "visible",
    HIDDEN = "hidden",
    DISABLED = "disabled",
    FOCUSED = "focused",
    WIDTH = "width",
    HEIGHT = "height",
    BOUNDING_BOX = "boundingBox",
    CONTENT_BOX = "contentBox",
    PARENT_NODE = "parentNode",
    OWNER_DOCUMENT = "ownerDocument",
    AUTO = "auto",
    SRC_NODE = "srcNode",
    BODY = "body",
    TAB_INDEX = "tabIndex",
    ID = "id",
    RENDER = "render",
    RENDERED = "rendered",
    DESTROYED = "destroyed",
    STRINGS = "strings",
    DIV = "<div></div>",
    CHANGE = "Change",
    LOADING = "loading",

    _UISET = "_uiSet",

    EMPTY_STR = "",
    EMPTY_FN = function() {},

    TRUE = true,
    FALSE = false,

    UI,
    ATTRS = {},
    UI_ATTRS = [VISIBLE, DISABLED, HEIGHT, WIDTH, FOCUSED, TAB_INDEX],

    WEBKIT = Y.UA.webkit,

    // Widget nodeid-to-instance map.
    _instances = {};

/**
 * A base class for widgets, providing:
 * <ul>
 *    <li>The render lifecycle method, in addition to the init and destroy
 *        lifecycle methods provide by Base</li>
 *    <li>Abstract methods to support consistent MVC structure across
 *        widgets: renderer, renderUI, bindUI, syncUI</li>
 *    <li>Support for common widget attributes, such as boundingBox, contentBox, visible,
 *        disabled, focused, strings</li>
 * </ul>
 *
 * @param config {Object} Object literal specifying widget configuration properties.
 *
 * @class Widget
 * @constructor
 * @extends Base
 */
function Widget(config) {

    // kweight
    var widget = this,
        parentNode,
        render,
        constructor = widget.constructor;

    widget._strs = {};
    widget._cssPrefix = constructor.CSS_PREFIX || _getClassName(constructor.NAME.toLowerCase());

    // We need a config for HTML_PARSER to work.
    config = config || {};

    Widget.superclass.constructor.call(widget, config);

    render = widget.get(RENDER);

    if (render) {
        // Render could be a node or boolean
        if (render !== TRUE) {
            parentNode = render;
        }
        widget.render(parentNode);
    }
}

/**
 * Static property provides a string to identify the class.
 * <p>
 * Currently used to apply class identifiers to the bounding box
 * and to classify events fired by the widget.
 * </p>
 *
 * @property NAME
 * @type String
 * @static
 */
Widget.NAME = "widget";

/**
 * Constant used to identify state changes originating from
 * the DOM (as opposed to the JavaScript model).
 *
 * @property UI_SRC
 * @type String
 * @static
 * @final
 */
UI = Widget.UI_SRC = "ui";

/**
 * Static property used to define the default attribute
 * configuration for the Widget.
 *
 * @property ATTRS
 * @type Object
 * @static
 */
Widget.ATTRS = ATTRS;

// Trying to optimize kweight by setting up attrs this way saves about 0.4K min'd

/**
 * @attribute id
 * @writeOnce
 * @default Generated using guid()
 * @type String
 */

ATTRS[ID] = {
    valueFn: "_guid",
    writeOnce: TRUE
};

/**
 * Flag indicating whether or not this Widget
 * has been through the render lifecycle phase.
 *
 * @attribute rendered
 * @readOnly
 * @default false
 * @type boolean
 */
ATTRS[RENDERED] = {
    value:FALSE,
    readOnly: TRUE
};

/**
 * @attribute boundingBox
 * @description The outermost DOM node for the Widget, used for sizing and positioning
 * of a Widget as well as a containing element for any decorator elements used
 * for skinning.
 * @type String | Node
 * @writeOnce
 */
ATTRS[BOUNDING_BOX] = {
    valueFn:"_defaultBB",
    setter: "_setBB",
    writeOnce: TRUE
};

/**
 * @attribute contentBox
 * @description A DOM node that is a direct descendant of a Widget's bounding box that
 * houses its content.
 * @type String | Node
 * @writeOnce
 */
ATTRS[CONTENT_BOX] = {
    valueFn:"_defaultCB",
    setter: "_setCB",
    writeOnce: TRUE
};

/**
 * @attribute tabIndex
 * @description Number (between -32767 to 32767) indicating the widget's
 * position in the default tab flow.  The value is used to set the
 * "tabIndex" attribute on the widget's bounding box.  Negative values allow
 * the widget to receive DOM focus programmatically (by calling the focus
 * method), while being removed from the default tab flow.  A value of
 * null removes the "tabIndex" attribute from the widget's bounding box.
 * @type Number
 * @default null
 */
ATTRS[TAB_INDEX] = {
    value: null,
    validator: "_validTabIndex"
};

/**
 * @attribute focused
 * @description Boolean indicating if the Widget, or one of its descendants,
 * has focus.
 * @readOnly
 * @default false
 * @type boolean
 */
ATTRS[FOCUSED] = {
    value: FALSE,
    readOnly:TRUE
};

/**
 * @attribute disabled
 * @description Boolean indicating if the Widget should be disabled. The disabled implementation
 * is left to the specific classes extending widget.
 * @default false
 * @type boolean
 */
ATTRS[DISABLED] = {
    value: FALSE
};

/**
 * @attribute visible
 * @description Boolean indicating whether or not the Widget is visible.
 * @default TRUE
 * @type boolean
 */
ATTRS[VISIBLE] = {
    value: TRUE
};

/**
 * @attribute height
 * @description String with units, or number, representing the height of the Widget. If a number is provided,
 * the default unit, defined by the Widgets DEF_UNIT, property is used.
 * @default EMPTY_STR
 * @type {String | Number}
 */
ATTRS[HEIGHT] = {
    value: EMPTY_STR
};

/**
 * @attribute width
 * @description String with units, or number, representing the width of the Widget. If a number is provided,
 * the default unit, defined by the Widgets DEF_UNIT, property is used.
 * @default EMPTY_STR
 * @type {String | Number}
 */
ATTRS[WIDTH] = {
    value: EMPTY_STR
};

/**
 * @attribute strings
 * @description Collection of strings used to label elements of the Widget's UI.
 * @default null
 * @type Object
 */
ATTRS[STRINGS] = {
    value: {},
    setter: "_strSetter",
    getter: "_strGetter"
};

/**
 * Whether or not to render the widget automatically after init, and optionally, to which parent node.
 *
 * @attribute render
 * @type boolean | Node
 * @writeOnce
 */
ATTRS[RENDER] = {
    value:FALSE,
    writeOnce:TRUE
};

/**
 * The css prefix which the static Widget.getClassName method should use when constructing class names
 *
 * @property CSS_PREFIX
 * @type String
 * @default Widget.NAME.toLowerCase()
 * @private
 * @static
 */
Widget.CSS_PREFIX = _getClassName(Widget.NAME.toLowerCase());

/**
 * Generate a standard prefixed classname for the Widget, prefixed by the default prefix defined
 * by the <code>Y.config.classNamePrefix</code> attribute used by <code>ClassNameManager</code> and
 * <code>Widget.NAME.toLowerCase()</code> (e.g. "yui-widget-xxxxx-yyyyy", based on default values for
 * the prefix and widget class name).
 * <p>
 * The instance based version of this method can be used to generate standard prefixed classnames,
 * based on the instances NAME, as opposed to Widget.NAME. This method should be used when you
 * need to use a constant class name across different types instances.
 * </p>
 * @method getClassName
 * @param {String*} args* 0..n strings which should be concatenated, using the default separator defined by ClassNameManager, to create the class name
 */
Widget.getClassName = function() {
    // arguments needs to be array'fied to concat
    return _getClassName.apply(ClassNameManager, [Widget.CSS_PREFIX].concat(Y.Array(arguments), true));
};

_getWidgetClassName = Widget.getClassName;

/**
 * Returns the widget instance whose bounding box contains, or is, the given node.
 * <p>
 * In the case of nested widgets, the nearest bounding box ancestor is used to
 * return the widget instance.
 * </p>
 * @method getByNode
 * @static
 * @param node {Node | String} The node for which to return a Widget instance. If a selector
 * string is passed in, which selects more than one node, the first node found is used.
 * @return {Widget} Widget instance, or null if not found.
 */
Widget.getByNode = function(node) {
    var widget,
        widgetMarker = _getWidgetClassName();

    node = Node.one(node);
    if (node) {
        node = node.ancestor("." + widgetMarker, true);
        if (node) {
            widget = _instances[Y.stamp(node, true)];
        }
    }

    return widget || null;
};

Y.extend(Widget, Y.Base, {

    /**
     * Returns a class name prefixed with the the value of the
     * <code>YUI.config.classNamePrefix</code> attribute + the instances <code>NAME</code> property.
     * Uses <code>YUI.config.classNameDelimiter</code> attribute to delimit the provided strings.
     * e.g.
     * <code>
     * <pre>
     *    // returns "yui-slider-foo-bar", for a slider instance
     *    var scn = slider.getClassName('foo','bar');
     *
     *    // returns "yui-overlay-foo-bar", for an overlay instance
     *    var ocn = overlay.getClassName('foo','bar');
     * </pre>
     * </code>
     *
     * @method getClassName
     * @param {String} [classnames*] One or more classname bits to be joined and prefixed
     */
    getClassName: function () {
        return _getClassName.apply(ClassNameManager, [this._cssPrefix].concat(Y.Array(arguments), true));
    },

    /**
     * Initializer lifecycle implementation for the Widget class. Registers the
     * widget instance, and runs through the Widget's HTML_PARSER definition.
     *
     * @method initializer
     * @protected
     * @param  config {Object} Configuration object literal for the widget
     */
    initializer: function(config) {

        var bb = this.get(BOUNDING_BOX);

        if (bb instanceof Node) {
            this._mapInstance(Y.stamp(bb));
        }

        /**
         * Notification event, which widget implementations can fire, when
         * they change the content of the widget. This event has no default
         * behavior and cannot be prevented, so the "on" or "after"
         * moments are effectively equivalent (with on listeners being invoked before
         * after listeners).
         *
         * @event widget:contentUpdate
         * @preventable false
         * @param {EventFacade} e The Event Facade
         */
    },

    /**
     * Utility method used to add an entry to the boundingBox id to instance map.
     *
     * This method can be used to populate the instance with lazily created boundingBox Node references.
     *
     * @method _mapInstance
     * @param {String} The boundingBox id
     * @protected
     */
    _mapInstance : function(id) {
        _instances[id] = this;
    },

    /**
     * Destructor lifecycle implementation for the Widget class. Purges events attached
     * to the bounding box and content box, removes them from the DOM and removes
     * the Widget from the list of registered widgets.
     *
     * @method destructor
     * @protected
     */
    destructor: function() {

        var boundingBox = this.get(BOUNDING_BOX),
            bbGuid;

        if (boundingBox instanceof Node) {
            bbGuid = Y.stamp(boundingBox,true);

            if (bbGuid in _instances) {
                delete _instances[bbGuid];
            }

            this._destroyBox();
        }
    },

    /**
     * <p>
     * Destroy lifecycle method. Fires the destroy
     * event, prior to invoking destructors for the
     * class hierarchy.
     *
     * Overrides Base's implementation, to support arguments to destroy
     * </p>
     * <p>
     * Subscribers to the destroy
     * event can invoke preventDefault on the event object, to prevent destruction
     * from proceeding.
     * </p>
     * @method destroy
     * @param destroyAllNodes {Boolean} If true, all nodes contained within the Widget are
     * removed and destroyed. Defaults to false due to potentially high run-time cost.
     * @return {Widget} A reference to this object
     * @chainable
     */
    destroy: function(destroyAllNodes) {
        this._destroyAllNodes = destroyAllNodes;
        return Widget.superclass.destroy.apply(this);
    },

    /**
     * Removes and destroys the widgets rendered boundingBox, contentBox,
     * and detaches bound UI events.
     *
     * @method _destroyBox
     * @protected
     */
    _destroyBox : function() {

        var boundingBox = this.get(BOUNDING_BOX),
            contentBox = this.get(CONTENT_BOX),
            deep = this._destroyAllNodes,
            same;

        same = boundingBox && boundingBox.compareTo(contentBox);

        if (this.UI_EVENTS) {
            this._destroyUIEvents();
        }

        this._unbindUI(boundingBox);

        if (contentBox) {
            if (deep) {
                contentBox.empty();
            }
            contentBox.remove(TRUE);
        }

        if (!same) {
            if (deep) {
                boundingBox.empty();
            }
            boundingBox.remove(TRUE);
        }
    },

    /**
     * Establishes the initial DOM for the widget. Invoking this
     * method will lead to the creating of all DOM elements for
     * the widget (or the manipulation of existing DOM elements
     * for the progressive enhancement use case).
     * <p>
     * This method should only be invoked once for an initialized
     * widget.
     * </p>
     * <p>
     * It delegates to the widget specific renderer method to do
     * the actual work.
     * </p>
     *
     * @method render
     * @chainable
     * @final
     * @param  parentNode {Object | String} Optional. The Node under which the
     * Widget is to be rendered. This can be a Node instance or a CSS selector string.
     * <p>
     * If the selector string returns more than one Node, the first node will be used
     * as the parentNode. NOTE: This argument is required if both the boundingBox and contentBox
     * are not currently in the document. If it's not provided, the Widget will be rendered
     * to the body of the current document in this case.
     * </p>
     */
    render: function(parentNode) {

        if (!this.get(DESTROYED) && !this.get(RENDERED)) {
             /**
              * Lifecycle event for the render phase, fired prior to rendering the UI
              * for the widget (prior to invoking the widget's renderer method).
              * <p>
              * Subscribers to the "on" moment of this event, will be notified
              * before the widget is rendered.
              * </p>
              * <p>
              * Subscribers to the "after" moment of this event, will be notified
              * after rendering is complete.
              * </p>
              *
              * @event render
              * @preventable _defRenderFn
              * @param {EventFacade} e The Event Facade
              */
            this.publish(RENDER, {
                queuable:FALSE,
                fireOnce:TRUE,
                defaultTargetOnly:TRUE,
                defaultFn: this._defRenderFn
            });

            this.fire(RENDER, {parentNode: (parentNode) ? Node.one(parentNode) : null});
        }
        return this;
    },

    /**
     * Default render handler
     *
     * @method _defRenderFn
     * @protected
     * @param {EventFacade} e The Event object
     * @param {Node} parentNode The parent node to render to, if passed in to the <code>render</code> method
     */
    _defRenderFn : function(e) {
        this._parentNode = e.parentNode;

        this.renderer();
        this._set(RENDERED, TRUE);

        this._removeLoadingClassNames();
    },

    /**
     * Creates DOM (or manipulates DOM for progressive enhancement)
     * This method is invoked by render() and is not chained
     * automatically for the class hierarchy (unlike initializer, destructor)
     * so it should be chained manually for subclasses if required.
     *
     * @method renderer
     * @protected
     */
    renderer: function() {
        // kweight
        var widget = this;

        widget._renderUI();
        widget.renderUI();

        widget._bindUI();
        widget.bindUI();

        widget._syncUI();
        widget.syncUI();
    },

    /**
     * Configures/Sets up listeners to bind Widget State to UI/DOM
     *
     * This method is not called by framework and is not chained
     * automatically for the class hierarchy.
     *
     * @method bindUI
     * @protected
     */
    bindUI: EMPTY_FN,

    /**
     * Adds nodes to the DOM
     *
     * This method is not called by framework and is not chained
     * automatically for the class hierarchy.
     *
     * @method renderUI
     * @protected
     */
    renderUI: EMPTY_FN,

    /**
     * Refreshes the rendered UI, based on Widget State
     *
     * This method is not called by framework and is not chained
     * automatically for the class hierarchy.
     *
     * @method syncUI
     * @protected
     *
     */
    syncUI: EMPTY_FN,

    /**
     * @method hide
     * @description Hides the Widget by setting the "visible" attribute to "false".
     * @chainable
     */
    hide: function() {
        return this.set(VISIBLE, FALSE);
    },

    /**
     * @method show
     * @description Shows the Widget by setting the "visible" attribute to "true".
     * @chainable
     */
    show: function() {
        return this.set(VISIBLE, TRUE);
    },

    /**
     * @method focus
     * @description Causes the Widget to receive the focus by setting the "focused"
     * attribute to "true".
     * @chainable
     */
    focus: function () {
        return this._set(FOCUSED, TRUE);
    },

    /**
     * @method blur
     * @description Causes the Widget to lose focus by setting the "focused" attribute
     * to "false"
     * @chainable
     */
    blur: function () {
        return this._set(FOCUSED, FALSE);
    },

    /**
     * @method enable
     * @description Set the Widget's "disabled" attribute to "false".
     * @chainable
     */
    enable: function() {
        return this.set(DISABLED, FALSE);
    },

    /**
     * @method disable
     * @description Set the Widget's "disabled" attribute to "true".
     * @chainable
     */
    disable: function() {
        return this.set(DISABLED, TRUE);
    },

    /**
     * @method _uiSizeCB
     * @protected
     * @param {boolean} expand
     */
    _uiSizeCB : function(expand) {
        this.get(CONTENT_BOX).toggleClass(_getWidgetClassName(CONTENT, "expanded"), expand);
    },

    /**
     * Helper method to collect the boundingBox and contentBox and append to the provided parentNode, if not
     * already a child. The owner document of the boundingBox, or the owner document of the contentBox will be used
     * as the document into which the Widget is rendered if a parentNode is node is not provided. If both the boundingBox and
     * the contentBox are not currently in the document, and no parentNode is provided, the widget will be rendered
     * to the current document's body.
     *
     * @method _renderBox
     * @private
     * @param {Node} parentNode The parentNode to render the widget to. If not provided, and both the boundingBox and
     * the contentBox are not currently in the document, the widget will be rendered to the current document's body.
     */
    _renderBox: function(parentNode) {

        // TODO: Performance Optimization [ More effective algo to reduce Node refs, compares, replaces? ]

        var widget = this, // kweight
            contentBox = widget.get(CONTENT_BOX),
            boundingBox = widget.get(BOUNDING_BOX),
            srcNode = widget.get(SRC_NODE),
            defParentNode = widget.DEF_PARENT_NODE,

            doc = (srcNode && srcNode.get(OWNER_DOCUMENT)) || boundingBox.get(OWNER_DOCUMENT) || contentBox.get(OWNER_DOCUMENT);

        // If srcNode (assume it's always in doc), have contentBox take its place (widget render responsible for re-use of srcNode contents)
        if (srcNode && !srcNode.compareTo(contentBox) && !contentBox.inDoc(doc)) {
            srcNode.replace(contentBox);
        }

        if (!boundingBox.compareTo(contentBox.get(PARENT_NODE)) && !boundingBox.compareTo(contentBox)) {
            // If contentBox box is already in the document, have boundingBox box take it's place
            if (contentBox.inDoc(doc)) {
                contentBox.replace(boundingBox);
            }
            boundingBox.appendChild(contentBox);
        }

        parentNode = parentNode || (defParentNode && Node.one(defParentNode));

        if (parentNode) {
            parentNode.appendChild(boundingBox);
        } else if (!boundingBox.inDoc(doc)) {
            Node.one(BODY).insert(boundingBox, 0);
        }
    },

    /**
     * Setter for the boundingBox attribute
     *
     * @method _setBB
     * @private
     * @param {Node|String} node
     * @return Node
     */
    _setBB: function(node) {
        return this._setBox(this.get(ID), node, this.BOUNDING_TEMPLATE, true);
    },

    /**
     * Setter for the contentBox attribute
     *
     * @method _setCB
     * @private
     * @param {Node|String} node
     * @return Node
     */
    _setCB: function(node) {
        return (this.CONTENT_TEMPLATE === null) ? this.get(BOUNDING_BOX) : this._setBox(null, node, this.CONTENT_TEMPLATE, false);
    },

    /**
     * Returns the default value for the boundingBox attribute.
     *
     * For the Widget class, this will most commonly be null (resulting in a new
     * boundingBox node instance being created), unless a srcNode was provided
     * and CONTENT_TEMPLATE is null, in which case it will be srcNode.
     * This behavior was introduced in 3.17.1 to accomodate single-box widgets
     * whose BB & CB both point to srcNode (e.g. Y.Button).
     *
     * @method _defaultBB
     * @protected
     */
    _defaultBB : function() {
        var node = this.get(SRC_NODE),
            nullCT = (this.CONTENT_TEMPLATE === null);

        return ((node && nullCT) ? node : null);
    },

    /**
     * Returns the default value for the contentBox attribute.
     *
     * For the Widget class, this will be the srcNode if provided, otherwise null (resulting in
     * a new contentBox node instance being created)
     *
     * @method _defaultCB
     * @protected
     */
    _defaultCB : function(node) {
        return this.get(SRC_NODE) || null;
    },

    /**
     * Helper method to set the bounding/content box, or create it from
     * the provided template if not found.
     *
     * @method _setBox
     * @private
     *
     * @param {String} id The node's id attribute
     * @param {Node|String} node The node reference
     * @param {String} template HTML string template for the node
     * @param {boolean} isBounding true if this is the boundingBox, false if it's the contentBox
     * @return {Node} The node
     */
    _setBox : function(id, node, template, isBounding) {

        node = Node.one(node);

        if (!node) {
            node = Node.create(template);

            if (isBounding) {
                this._bbFromTemplate = true;
            } else {
                this._cbFromTemplate = true;
            }
        }

        if (!node.get(ID)) {
            node.set(ID, id || Y.guid());
        }

        return node;
    },

    /**
     * Initializes the UI state for the Widget's bounding/content boxes.
     *
     * @method _renderUI
     * @protected
     */
    _renderUI: function() {
        this._renderBoxClassNames();
        this._renderBox(this._parentNode);
    },

    /**
     * Applies standard class names to the boundingBox and contentBox
     *
     * @method _renderBoxClassNames
     * @protected
     */
    _renderBoxClassNames : function() {
        var classes = this._getClasses(),
            cl,
            boundingBox = this.get(BOUNDING_BOX),
            i;

        boundingBox.addClass(_getWidgetClassName());

        // Start from Widget Sub Class
        for (i = classes.length-3; i >= 0; i--) {
            cl = classes[i];
            boundingBox.addClass(cl.CSS_PREFIX || _getClassName(cl.NAME.toLowerCase()));
        }

        // Use instance based name for content box
        this.get(CONTENT_BOX).addClass(this.getClassName(CONTENT));
    },

    /**
     * Removes class names representative of the widget's loading state from
     * the boundingBox.
     *
     * @method _removeLoadingClassNames
     * @protected
     */
    _removeLoadingClassNames: function () {

        var boundingBox = this.get(BOUNDING_BOX),
            contentBox = this.get(CONTENT_BOX),
            instClass = this.getClassName(LOADING),
            widgetClass = _getWidgetClassName(LOADING);

        boundingBox.removeClass(widgetClass)
                   .removeClass(instClass);

        contentBox.removeClass(widgetClass)
                  .removeClass(instClass);
    },

    /**
     * Sets up DOM and CustomEvent listeners for the widget.
     *
     * @method _bindUI
     * @protected
     */
    _bindUI: function() {
        this._bindAttrUI(this._UI_ATTRS.BIND);
        this._bindDOM();
    },

    /**
     * @method _unbindUI
     * @protected
     */
    _unbindUI : function(boundingBox) {
        this._unbindDOM(boundingBox);
    },

    /**
     * Sets up DOM listeners, on elements rendered by the widget.
     *
     * @method _bindDOM
     * @protected
     */
    _bindDOM : function() {
        var oDocument = this.get(BOUNDING_BOX).get(OWNER_DOCUMENT),
            focusHandle = Widget._hDocFocus;

        // Shared listener across all Widgets.
        if (!focusHandle) {
            focusHandle = Widget._hDocFocus = oDocument.on("focus", this._onDocFocus, this);
            focusHandle.listeners = {
                count: 0
            };
        }

        focusHandle.listeners[Y.stamp(this, true)] = true;
        focusHandle.listeners.count++;

        //	Fix for Webkit:
        //	Document doesn't receive focus in Webkit when the user mouses
        //	down on it, so the "focused" attribute won't get set to the
        //	correct value. Keeping this instance based for now, potential better performance.
        //  Otherwise we'll end up looking up widgets from the DOM on every mousedown.
        if (WEBKIT){
            this._hDocMouseDown = oDocument.on("mousedown", this._onDocMouseDown, this);
        }
    },

    /**
     * @method _unbindDOM
     * @protected
     */
    _unbindDOM : function(boundingBox) {

        var focusHandle = Widget._hDocFocus,
            yuid = Y.stamp(this, true),
            focusListeners,
            mouseHandle = this._hDocMouseDown;

        if (focusHandle) {

            focusListeners = focusHandle.listeners;

            if (focusListeners[yuid]) {
                delete focusListeners[yuid];
                focusListeners.count--;
            }

            if (focusListeners.count === 0) {
                focusHandle.detach();
                Widget._hDocFocus = null;
            }
        }

        if (WEBKIT && mouseHandle) {
            mouseHandle.detach();
        }
    },

    /**
     * Updates the widget UI to reflect the attribute state.
     *
     * @method _syncUI
     * @protected
     */
    _syncUI: function() {
        this._syncAttrUI(this._UI_ATTRS.SYNC);
    },

    /**
     * Sets the height on the widget's bounding box element
     *
     * @method _uiSetHeight
     * @protected
     * @param {String | Number} val
     */
    _uiSetHeight: function(val) {
        this._uiSetDim(HEIGHT, val);
        this._uiSizeCB((val !== EMPTY_STR && val !== AUTO));
    },

    /**
     * Sets the width on the widget's bounding box element
     *
     * @method _uiSetWidth
     * @protected
     * @param {String | Number} val
     */
    _uiSetWidth: function(val) {
        this._uiSetDim(WIDTH, val);
    },

    /**
     * @method _uiSetDim
     * @private
     * @param {String} dim The dimension - "width" or "height"
     * @param {Number | String} val The value to set
     */
    _uiSetDim: function(dimension, val) {
        this.get(BOUNDING_BOX).setStyle(dimension, L.isNumber(val) ? val + this.DEF_UNIT : val);
    },

    /**
     * Sets the visible state for the UI
     *
     * @method _uiSetVisible
     * @protected
     * @param {boolean} val
     */
    _uiSetVisible: function(val) {
        this.get(BOUNDING_BOX).toggleClass(this.getClassName(HIDDEN), !val);
    },

    /**
     * Sets the disabled state for the UI
     *
     * @method _uiSetDisabled
     * @protected
     * @param {boolean} val
     */
    _uiSetDisabled: function(val) {
        this.get(BOUNDING_BOX).toggleClass(this.getClassName(DISABLED), val);
    },

    /**
     * Sets the focused state for the UI
     *
     * @method _uiSetFocused
     * @protected
     * @param {boolean} val
     * @param {string} src String representing the source that triggered an update to
     * the UI.
     */
    _uiSetFocused: function(val, src) {
         var boundingBox = this.get(BOUNDING_BOX);
         boundingBox.toggleClass(this.getClassName(FOCUSED), val);

         if (src !== UI) {
            if (val) {
                boundingBox.focus();
            } else {
                boundingBox.blur();
            }
         }
    },

    /**
     * Set the tabIndex on the widget's rendered UI
     *
     * @method _uiSetTabIndex
     * @protected
     * @param Number
     */
    _uiSetTabIndex: function(index) {
        var boundingBox = this.get(BOUNDING_BOX);

        if (L.isNumber(index)) {
            boundingBox.set(TAB_INDEX, index);
        } else {
            boundingBox.removeAttribute(TAB_INDEX);
        }
    },

    /**
     * @method _onDocMouseDown
     * @description "mousedown" event handler for the owner document of the
     * widget's bounding box.
     * @protected
     * @param {EventFacade} evt The event facade for the DOM focus event
     */
    _onDocMouseDown: function (evt) {
        if (this._domFocus) {
            this._onDocFocus(evt);
        }
    },

    /**
     * DOM focus event handler, used to sync the state of the Widget with the DOM
     *
     * @method _onDocFocus
     * @protected
     * @param {EventFacade} evt The event facade for the DOM focus event
     */
    _onDocFocus: function (evt) {
        var widget = Widget.getByNode(evt.target),
            activeWidget = Widget._active;

        if (activeWidget && (activeWidget !== widget)) {
            activeWidget._domFocus = false;
            activeWidget._set(FOCUSED, false, {src:UI});

            Widget._active = null;
        }

        if (widget) {
            widget._domFocus = true;
            widget._set(FOCUSED, true, {src:UI});

            Widget._active = widget;
        }
    },

    /**
     * Generic toString implementation for all widgets.
     *
     * @method toString
     * @return {String} The default string value for the widget [ displays the NAME of the instance, and the unique id ]
     */
    toString: function() {
        // Using deprecated name prop for kweight squeeze.
        return this.name + "[" + this.get(ID) + "]";
    },

    /**
     * Default unit to use for dimension values
     *
     * @property DEF_UNIT
     * @type String
     */
    DEF_UNIT : "px",

    /**
     * Default node to render the bounding box to. If not set,
     * will default to the current document body.
     *
     * @property DEF_PARENT_NODE
     * @type String | Node
     */
    DEF_PARENT_NODE : null,

    /**
     * Property defining the markup template for content box. If your Widget doesn't
     * need the dual boundingBox/contentBox structure, set CONTENT_TEMPLATE to null,
     * and contentBox and boundingBox will both point to the same Node.
     *
     * @property CONTENT_TEMPLATE
     * @type String
     */
    CONTENT_TEMPLATE : DIV,

    /**
     * Property defining the markup template for bounding box.
     *
     * @property BOUNDING_TEMPLATE
     * @type String
     */
    BOUNDING_TEMPLATE : DIV,

    /**
     * @method _guid
     * @protected
     */
    _guid : function() {
        return Y.guid();
    },

    /**
     * @method _validTabIndex
     * @protected
     * @param {Number} tabIndex
     */
    _validTabIndex : function (tabIndex) {
        return (L.isNumber(tabIndex) || L.isNull(tabIndex));
    },

    /**
     * Binds after listeners for the list of attributes provided
     *
     * @method _bindAttrUI
     * @private
     * @param {Array} attrs
     */
    _bindAttrUI : function(attrs) {
        var i,
            l = attrs.length;

        for (i = 0; i < l; i++) {
            this.after(attrs[i] + CHANGE, this._setAttrUI);
        }
    },

    /**
     * Invokes the _uiSet&#61;ATTR NAME&#62; method for the list of attributes provided
     *
     * @method _syncAttrUI
     * @private
     * @param {Array} attrs
     */
    _syncAttrUI : function(attrs) {
        var i, l = attrs.length, attr;
        for (i = 0; i < l; i++) {
            attr = attrs[i];
            this[_UISET + _toInitialCap(attr)](this.get(attr));
        }
    },

    /**
     * @method _setAttrUI
     * @private
     * @param {EventFacade} e
     */
    _setAttrUI : function(e) {
        if (e.target === this) {
            this[_UISET + _toInitialCap(e.attrName)](e.newVal, e.src);
        }
    },

    /**
     * The default setter for the strings attribute. Merges partial sets
     * into the full string set, to allow users to partial sets of strings
     *
     * @method _strSetter
     * @protected
     * @param {Object} strings
     * @return {String} The full set of strings to set
     */
    _strSetter : function(strings) {
        return Y.merge(this.get(STRINGS), strings);
    },

    /**
     * Helper method to get a specific string value
     *
     * @deprecated Used by deprecated WidgetLocale implementations.
     * @method getString
     * @param {String} key
     * @return {String} The string
     */
    getString : function(key) {
        return this.get(STRINGS)[key];
    },

    /**
     * Helper method to get the complete set of strings for the widget
     *
     * @deprecated  Used by deprecated WidgetLocale implementations.
     * @method getStrings
     * @param {String} key
     * @return {String} The strings
     */
    getStrings : function() {
        return this.get(STRINGS);
    },

    /**
     * The lists of UI attributes to bind and sync for widget's _bindUI and _syncUI implementations
     *
     * @property _UI_ATTRS
     * @type Object
     * @private
     */
    _UI_ATTRS : {
        BIND: UI_ATTRS,
        SYNC: UI_ATTRS
    }
});

Y.Widget = Widget;


}, '3.17.1', {
    "requires": [
        "attribute",
        "base-base",
        "base-pluginhost",
        "classnamemanager",
        "event-focus",
        "node-base",
        "node-style"
    ],
    "skinnable": true
});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-htmlparser', function (Y, NAME) {

/**
 * Adds HTML Parser support to the base Widget class
 *
 * @module widget
 * @submodule widget-htmlparser
 * @for Widget
 */

var Widget = Y.Widget,
    Node = Y.Node,
    Lang = Y.Lang,

    SRC_NODE = "srcNode",
    CONTENT_BOX = "contentBox";

/**
 * Object hash, defining how attribute values are to be parsed from
 * markup contained in the widget's content box. e.g.:
 * <pre>
 *   {
 *       // Set single Node references using selector syntax
 *       // (selector is run through node.one)
 *       titleNode: "span.yui-title",
 *       // Set NodeList references using selector syntax
 *       // (array indicates selector is to be run through node.all)
 *       listNodes: ["li.yui-item"],
 *       // Set other attribute types, using a parse function.
 *       // Context is set to the widget instance.
 *       label: function(contentBox) {
 *           return contentBox.one("span.title").get("innerHTML");
 *       }
 *   }
 * </pre>
 *
 * @property HTML_PARSER
 * @type Object
 * @static
 */
Widget.HTML_PARSER = {};

/**
 * The build configuration for the Widget class.
 * <p>
 * Defines the static fields which need to be aggregated,
 * when this class is used as the main class passed to
 * the <a href="Base.html#method_build">Base.build</a> method.
 * </p>
 * @property _buildCfg
 * @type Object
 * @static
 * @final
 * @private
 */
Widget._buildCfg = {
    aggregates : ["HTML_PARSER"]
};

/**
 * The DOM node to parse for configuration values, passed to the Widget's HTML_PARSER definition
 *
 * @attribute srcNode
 * @type String | Node
 * @writeOnce
 */
Widget.ATTRS[SRC_NODE] = {
    value: null,
    setter: Node.one,
    getter: "_getSrcNode",
    writeOnce: true
};

Y.mix(Widget.prototype, {

    /**
     * @method _getSrcNode
     * @protected
     * @return {Node} The Node to apply HTML_PARSER to
     */
    _getSrcNode : function(val) {
        return val || this.get(CONTENT_BOX);
    },

    /**
     * Implement the BaseCore _preAddAttrs method hook, to add
     * the srcNode and related attributes, so that HTML_PARSER
     * (which relies on `this.get("srcNode")`) can merge in it's
     * results before the rest of the attributes are added.
     *
     * @method _preAddAttrs
     * @protected
     *
     * @param attrs {Object} The full hash of statically defined ATTRS
     * attributes being added for this instance
     *
     * @param userVals {Object} The hash of user values passed to
     * the constructor
     *
     * @param lazy {boolean} Whether or not to add the attributes lazily
     */
    _preAddAttrs : function(attrs, userVals, lazy) {

        var preAttrs = {
            id : attrs.id,
            boundingBox : attrs.boundingBox,
            contentBox : attrs.contentBox,
            srcNode : attrs.srcNode
        };

        this.addAttrs(preAttrs, userVals, lazy);

        delete attrs.boundingBox;
        delete attrs.contentBox;
        delete attrs.srcNode;
        delete attrs.id;

        if (this._applyParser) {
            this._applyParser(userVals);
        }
    },

    /**
     * @method _applyParsedConfig
     * @protected
     * @return {Object} The merged configuration literal
     */
    _applyParsedConfig : function(node, cfg, parsedCfg) {
        return (parsedCfg) ? Y.mix(cfg, parsedCfg, false) : cfg;
    },

    /**
     * Utility method used to apply the <code>HTML_PARSER</code> configuration for the
     * instance, to retrieve config data values.
     *
     * @method _applyParser
     * @protected
     * @param config {Object} User configuration object (will be populated with values from Node)
     */
    _applyParser : function(config) {

        var widget = this,
            srcNode = this._getNodeToParse(),
            schema = widget._getHtmlParser(),
            parsedConfig,
            val;

        if (schema && srcNode) {
            Y.Object.each(schema, function(v, k, o) {
                val = null;

                if (Lang.isFunction(v)) {
                    val = v.call(widget, srcNode);
                } else {
                    if (Lang.isArray(v)) {
                        val = srcNode.all(v[0]);
                        if (val.isEmpty()) {
                            val = null;
                        }
                    } else {
                        val = srcNode.one(v);
                    }
                }

                if (val !== null && val !== undefined) {
                    parsedConfig = parsedConfig || {};
                    parsedConfig[k] = val;
                }
            });
        }
        config = widget._applyParsedConfig(srcNode, config, parsedConfig);
    },

    /**
     * Determines whether we have a node reference which we should try and parse.
     *
     * The current implementation does not parse nodes generated from CONTENT_TEMPLATE,
     * only explicitly set srcNode, or contentBox attributes.
     *
     * @method _getNodeToParse
     * @return {Node} The node reference to apply HTML_PARSER to.
     * @private
     */
    _getNodeToParse : function() {
        var srcNode = this.get("srcNode");
        return (!this._cbFromTemplate) ? srcNode : null;
    },

    /**
     * Gets the HTML_PARSER definition for this instance, by merging HTML_PARSER
     * definitions across the class hierarchy.
     *
     * @private
     * @method _getHtmlParser
     * @return {Object} HTML_PARSER definition for this instance
     */
    _getHtmlParser : function() {
        // Removed caching for kweight. This is a private method
        // and only called once so don't need to cache HTML_PARSER
        var classes = this._getClasses(),
            parser = {},
            i, p;

        for (i = classes.length - 1; i >= 0; i--) {
            p = classes[i].HTML_PARSER;
            if (p) {
                Y.mix(parser, p, true);
            }
        }
        return parser;
    }
});


}, '3.17.1', {"requires": ["widget-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-skin', function (Y, NAME) {

/**
 * Provides skin related utlility methods.
 *
 * @module widget
 * @submodule widget-skin
 */
var BOUNDING_BOX = "boundingBox",
    CONTENT_BOX = "contentBox",
    SKIN = "skin",
    _getClassName = Y.ClassNameManager.getClassName;

/**
 * Returns the name of the skin that's currently applied to the widget.
 *
 * Searches up the Widget's ancestor axis for, by default, a class
 * yui3-skin-(name), and returns the (name) portion. Otherwise, returns null.
 *
 * This is only really useful after the widget's DOM structure is in the
 * document, either by render or by progressive enhancement.
 *
 * @method getSkinName
 * @for Widget
 * @param {String} [skinPrefix] The prefix which the implementation uses for the skin
 * ("yui3-skin-" is the default).
 *
 * NOTE: skinPrefix will be used as part of a regular expression:
 *
 *     new RegExp('\\b' + skinPrefix + '(\\S+)')
 *
 * Although an unlikely use case, literal characters which may result in an invalid
 * regular expression should be escaped.
 *
 * @return {String} The name of the skin, or null, if a matching skin class is not found.
 */

Y.Widget.prototype.getSkinName = function (skinPrefix) {

    var root = this.get( CONTENT_BOX ) || this.get( BOUNDING_BOX ),
        match,
        search;

    skinPrefix = skinPrefix || _getClassName(SKIN, "");

    search = new RegExp( '\\b' + skinPrefix + '(\\S+)' );

    if ( root ) {
        root.ancestor( function ( node ) {
            match = node.get( 'className' ).match( search );
            return match;
        } );
    }

    return ( match ) ? match[1] : null;
};


}, '3.17.1', {"requires": ["widget-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-uievents', function (Y, NAME) {

/**
 * Support for Widget UI Events (Custom Events fired by the widget, which wrap the underlying DOM events - e.g. widget:click, widget:mousedown)
 *
 * @module widget
 * @submodule widget-uievents
 */

var BOUNDING_BOX = "boundingBox",
    Widget = Y.Widget,
    RENDER = "render",
    L = Y.Lang,
    EVENT_PREFIX_DELIMITER = ":",

    //  Map of Node instances serving as a delegation containers for a specific
    //  event type to Widget instances using that delegation container.
    _uievts = Y.Widget._uievts = Y.Widget._uievts || {};

Y.mix(Widget.prototype, {

    /**
     * Destructor logic for UI event infrastructure,
     * invoked during Widget destruction.
     *
     * @method _destroyUIEvents
     * @for Widget
     * @private
     */
    _destroyUIEvents: function() {

        var widgetGuid = Y.stamp(this, true);

        Y.each(_uievts, function (info, key) {
            if (info.instances[widgetGuid]) {
                //  Unregister this Widget instance as needing this delegated
                //  event listener.
                delete info.instances[widgetGuid];

                //  There are no more Widget instances using this delegated
                //  event listener, so detach it.

                if (Y.Object.isEmpty(info.instances)) {
                    info.handle.detach();

                    if (_uievts[key]) {
                        delete _uievts[key];
                    }
                }
            }
        });
    },

    /**
     * Map of DOM events that should be fired as Custom Events by the
     * Widget instance.
     *
     * @property UI_EVENTS
     * @for Widget
     * @type Object
     */
    UI_EVENTS: Y.Node.DOM_EVENTS,

    /**
     * Returns the node on which to bind delegate listeners.
     *
     * @method _getUIEventNode
     * @for Widget
     * @protected
     */
    _getUIEventNode: function () {
        return this.get(BOUNDING_BOX);
    },

    /**
     * Binds a delegated DOM event listener of the specified type to the
     * Widget's outtermost DOM element to facilitate the firing of a Custom
     * Event of the same type for the Widget instance.
     *
     * @method _createUIEvent
     * @for Widget
     * @param type {String} String representing the name of the event
     * @private
     */
    _createUIEvent: function (type) {

        var uiEvtNode = this._getUIEventNode(),
            key = (Y.stamp(uiEvtNode) + type),
            info = _uievts[key],
            handle;

        //  For each Node instance: Ensure that there is only one delegated
        //  event listener used to fire Widget UI events.

        if (!info) {

            handle = uiEvtNode.delegate(type, function (evt) {

                var widget = Widget.getByNode(this);

                // Widget could be null if node instance belongs to
                // another Y instance.

                if (widget) {
                    if (widget._filterUIEvent(evt)) {
                        widget.fire(evt.type, { domEvent: evt });
                    }
                }

            }, "." + Y.Widget.getClassName());

            _uievts[key] = info = { instances: {}, handle: handle };
        }

        //  Register this Widget as using this Node as a delegation container.
        info.instances[Y.stamp(this)] = 1;
    },

    /**
     * This method is used to determine if we should fire
     * the UI Event or not. The default implementation makes sure
     * that for nested delegates (nested unrelated widgets), we don't
     * fire the UI event listener more than once at each level.
     *
     * <p>For example, without the additional filter, if you have nested
     * widgets, each widget will have a delegate listener. If you
     * click on the inner widget, the inner delegate listener's
     * filter will match once, but the outer will match twice
     * (based on delegate's design) - once for the inner widget,
     * and once for the outer.</p>
     *
     * @method _filterUIEvent
     * @for Widget
     * @param {DOMEventFacade} evt
     * @return {boolean} true if it's OK to fire the custom UI event, false if not.
     * @private
     *
     */
    _filterUIEvent: function(evt) {
        // Either it's hitting this widget's delegate container (and not some other widget's),
        // or the container it's hitting is handling this widget's ui events.
        return (evt.currentTarget.compareTo(evt.container) || evt.container.compareTo(this._getUIEventNode()));
    },

    /**
     * Determines if the specified event is a UI event.
     *
     * @private
     * @method _isUIEvent
     * @for Widget
     * @param type {String} String representing the name of the event
     * @return {String} Event Returns the name of the UI Event, otherwise
     * undefined.
     */
    _getUIEvent: function (type) {

        if (L.isString(type)) {
            var sType = this.parseType(type)[1],
                iDelim,
                returnVal;

            if (sType) {
                // TODO: Get delimiter from ET, or have ET support this.
                iDelim = sType.indexOf(EVENT_PREFIX_DELIMITER);
                if (iDelim > -1) {
                    sType = sType.substring(iDelim + EVENT_PREFIX_DELIMITER.length);
                }

                if (this.UI_EVENTS[sType]) {
                    returnVal = sType;
                }
            }

            return returnVal;
        }
    },

    /**
     * Sets up infrastructure required to fire a UI event.
     *
     * @private
     * @method _initUIEvent
     * @for Widget
     * @param type {String} String representing the name of the event
     * @return {String}
     */
    _initUIEvent: function (type) {
        var sType = this._getUIEvent(type),
            queue = this._uiEvtsInitQueue || {};

        if (sType && !queue[sType]) {

            this._uiEvtsInitQueue = queue[sType] = 1;

            this.after(RENDER, function() {
                this._createUIEvent(sType);
                delete this._uiEvtsInitQueue[sType];
            });
        }
    },

    //  Override of "on" from Base to facilitate the firing of Widget events
    //  based on DOM events of the same name/type (e.g. "click", "mouseover").
    //  Temporary solution until we have the ability to listen to when
    //  someone adds an event listener (bug 2528230)
    on: function (type) {
        this._initUIEvent(type);
        return Widget.superclass.on.apply(this, arguments);
    },

    //  Override of "publish" from Base to facilitate the firing of Widget events
    //  based on DOM events of the same name/type (e.g. "click", "mouseover").
    //  Temporary solution until we have the ability to listen to when
    //  someone publishes an event (bug 2528230)
    publish: function (type, config) {
        var sType = this._getUIEvent(type);
        if (sType && config && config.defaultFn) {
            this._initUIEvent(sType);
        }
        return Widget.superclass.publish.apply(this, arguments);
    }

}, true); // overwrite existing EventTarget methods


}, '3.17.1', {"requires": ["node-event-delegate", "widget-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-autohide', function (Y, NAME) {

/**
 * A widget-level extension that provides ability to hide widget when
 * certain events occur.
 *
 * @module widget-autohide
 * @author eferraiuolo, tilomitra
 * @since 3.4.0
 */


var WIDGET_AUTOHIDE    = 'widgetAutohide',
    AUTOHIDE            = 'autohide',
    CLICK_OUTSIDE     = 'clickoutside',
    FOCUS_OUTSIDE     = 'focusoutside',
    DOCUMENT            = 'document',
    KEY                 = 'key',
    PRESS_ESCAPE         = 'esc',
    BIND_UI             = 'bindUI',
    SYNC_UI             = "syncUI",
    RENDERED            = "rendered",
    BOUNDING_BOX        = "boundingBox",
    VISIBLE             = "visible",
    CHANGE              = 'Change',

    getCN               = Y.ClassNameManager.getClassName;

/**
 * The WidgetAutohide class provides the hideOn attribute which can
 * be used to hide the widget when certain events occur.
 *
 * @class WidgetAutohide
 * @param {Object} config User configuration object
 */
function WidgetAutohide(config) {
    Y.after(this._bindUIAutohide, this, BIND_UI);
    Y.after(this._syncUIAutohide, this, SYNC_UI);


    if (this.get(RENDERED)) {
        this._bindUIAutohide();
        this._syncUIAutohide();
    }

}

/**
* Static property used to define the default attribute
* configuration introduced by WidgetAutohide.
*
* @property ATTRS
* @static
* @type Object
*/
WidgetAutohide.ATTRS = {


    /**
     * @attribute hideOn
     * @type array
     *
     * @description An array of objects corresponding to the nodes, events, and keycodes to hide the widget on.
     * The implementer can supply an array of objects, with each object having the following properties:
     * <p>eventName: (string, required): The eventName to listen to.</p>
     * <p>node: (Y.Node, optional): The Y.Node that will fire the event (defaults to the boundingBox of the widget)</p>
     * <p>keyCode: (string, optional): If listening for key events, specify the keyCode</p>
     * <p>By default, this attribute consists of one object which will cause the widget to hide if the
     * escape key is pressed.</p>
     */
    hideOn: {
        validator: Y.Lang.isArray,
        valueFn  : function() {
            return [
                {
                    node: Y.one(DOCUMENT),
                    eventName: KEY,
                    keyCode: PRESS_ESCAPE
                }
            ];
        }
    }
};

WidgetAutohide.prototype = {
    // *** Instance Members *** //

        _uiHandlesAutohide : null,

        // *** Lifecycle Methods *** //

        destructor : function () {

            this._detachUIHandlesAutohide();
        },

        /**
         * Binds event listeners to the widget.
         * <p>
         * This method in invoked after bindUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _bindUIAutohide
         * @protected
         */
        _bindUIAutohide : function () {

            this.after(VISIBLE+CHANGE, this._afterHostVisibleChangeAutohide);
            this.after("hideOnChange", this._afterHideOnChange);
        },

        /**
         * Syncs up the widget based on its current state. In particular, removes event listeners if
         * widget is not visible, and attaches them otherwise.
         * <p>
         * This method in invoked after syncUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _syncUIAutohide
         * @protected
         */
        _syncUIAutohide : function () {

            this._uiSetHostVisibleAutohide(this.get(VISIBLE));
        },

        // *** Private Methods *** //

        /**
         * Removes event listeners if widget is not visible, and attaches them otherwise.
         *
         * @method _uiSetHostVisibleAutohide
         * @protected
         */
        _uiSetHostVisibleAutohide : function (visible) {

            if (visible) {
                //this._attachUIHandlesAutohide();
                Y.later(1, this, '_attachUIHandlesAutohide');
            } else {
                this._detachUIHandlesAutohide();
            }
        },

        /**
         * Iterates through all objects in the hideOn attribute and creates event listeners.
         *
         * @method _attachUIHandlesAutohide
         * @protected
         */
        _attachUIHandlesAutohide : function () {

            if (this._uiHandlesAutohide) { return; }

            var bb = this.get(BOUNDING_BOX),
                hide = Y.bind(this.hide,this),
                uiHandles = [],
                self = this,
                hideOn = this.get('hideOn'),
                i = 0,
                o = {node: undefined, ev: undefined, keyCode: undefined};

                //push all events on which the widget should be hidden
                for (; i < hideOn.length; i++) {

                    o.node = hideOn[i].node;
                    o.ev = hideOn[i].eventName;
                    o.keyCode = hideOn[i].keyCode;

                    //no keycode or node defined
                    if (!o.node && !o.keyCode && o.ev) {
                        uiHandles.push(bb.on(o.ev, hide));
                    }

                    //node defined, no keycode (not a keypress)
                    else if (o.node && !o.keyCode && o.ev) {
                        uiHandles.push(o.node.on(o.ev, hide));
                    }

                    //node defined, keycode defined, event defined (its a key press)
                    else if (o.node && o.keyCode && o.ev) {
                        uiHandles.push(o.node.on(o.ev, hide, o.keyCode));
                    }

                    else {
                    }

                }

            this._uiHandlesAutohide = uiHandles;
        },

        /**
         * Detaches all event listeners created by this extension
         *
         * @method _detachUIHandlesAutohide
         * @protected
         */
        _detachUIHandlesAutohide : function () {

            Y.each(this._uiHandlesAutohide, function(h){
                h.detach();
            });
            this._uiHandlesAutohide = null;
        },

        /**
         * Default function called when the visibility of the widget changes. Determines
         * whether to attach or detach event listeners based on the visibility of the widget.
         *
         * @method _afterHostVisibleChangeAutohide
         * @protected
         */
        _afterHostVisibleChangeAutohide : function (e) {

            this._uiSetHostVisibleAutohide(e.newVal);
        },

        /**
         * Default function called when hideOn Attribute is changed. Remove existing listeners and create new listeners.
         *
         * @method _afterHideOnChange
         * @protected
         */
        _afterHideOnChange : function(e) {
            this._detachUIHandlesAutohide();

            if (this.get(VISIBLE)) {
                this._attachUIHandlesAutohide();
            }
        }
};

Y.WidgetAutohide = WidgetAutohide;


}, '3.17.1', {"requires": ["base-build", "event-key", "event-outside", "widget"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('base-build', function (Y, NAME) {

    /**
     * The base-build submodule provides Base.build functionality, which
     * can be used to create custom classes, by aggregating extensions onto
     * a main class.
     *
     * @module base
     * @submodule base-build
     * @for Base
     */
    var BaseCore = Y.BaseCore,
        Base     = Y.Base,
        L        = Y.Lang,

        INITIALIZER = "initializer",
        DESTRUCTOR  = "destructor",
        AGGREGATES  = ["_PLUG", "_UNPLUG"],

        build;

    // Utility function used in `_buildCfg` to aggregate array values into a new
    // array from the sender constructor to the receiver constructor.
    function arrayAggregator(prop, r, s) {
        if (s[prop]) {
            r[prop] = (r[prop] || []).concat(s[prop]);
        }
    }

    // Utility function used in `_buildCfg` to aggregate `_ATTR_CFG` array
    // values from the sender constructor into a new array on receiver's
    // constructor, and clear the cached hash.
    function attrCfgAggregator(prop, r, s) {
        if (s._ATTR_CFG) {
            // Clear cached hash.
            r._ATTR_CFG_HASH = null;

            arrayAggregator.apply(null, arguments);
        }
    }

    // Utility function used in `_buildCfg` to aggregate ATTRS configs from one
    // the sender constructor to the receiver constructor.
    function attrsAggregator(prop, r, s) {
        BaseCore.modifyAttrs(r, s.ATTRS);
    }

    Base._build = function(name, main, extensions, px, sx, cfg) {

        var build = Base._build,

            builtClass = build._ctor(main, cfg),
            buildCfg = build._cfg(main, cfg, extensions),

            _mixCust = build._mixCust,

            dynamic = builtClass._yuibuild.dynamic,

            i, l, extClass, extProto,
            initializer,
            destructor;

        // Augment/Aggregate
        for (i = 0, l = extensions.length; i < l; i++) {
            extClass = extensions[i];

            extProto = extClass.prototype;

            initializer = extProto[INITIALIZER];
            destructor = extProto[DESTRUCTOR];
            delete extProto[INITIALIZER];
            delete extProto[DESTRUCTOR];

            // Prototype, old non-displacing augment
            Y.mix(builtClass, extClass, true, null, 1);

            // Custom Statics
            _mixCust(builtClass, extClass, buildCfg);

            if (initializer) {
                extProto[INITIALIZER] = initializer;
            }

            if (destructor) {
                extProto[DESTRUCTOR] = destructor;
            }

            builtClass._yuibuild.exts.push(extClass);
        }

        if (px) {
            Y.mix(builtClass.prototype, px, true);
        }

        if (sx) {
            Y.mix(builtClass, build._clean(sx, buildCfg), true);
            _mixCust(builtClass, sx, buildCfg);
        }

        builtClass.prototype.hasImpl = build._impl;

        if (dynamic) {
            builtClass.NAME = name;
            builtClass.prototype.constructor = builtClass;

            // Carry along the reference to `modifyAttrs()` from `main`.
            builtClass.modifyAttrs = main.modifyAttrs;
        }

        return builtClass;
    };

    build = Base._build;

    Y.mix(build, {

        _mixCust: function(r, s, cfg) {

            var aggregates,
                custom,
                statics,
                aggr,
                l,
                i;

            if (cfg) {
                aggregates = cfg.aggregates;
                custom = cfg.custom;
                statics = cfg.statics;
            }

            if (statics) {
                Y.mix(r, s, true, statics);
            }

            if (aggregates) {
                for (i = 0, l = aggregates.length; i < l; i++) {
                    aggr = aggregates[i];
                    if (!r.hasOwnProperty(aggr) && s.hasOwnProperty(aggr)) {
                        r[aggr] = L.isArray(s[aggr]) ? [] : {};
                    }
                    Y.aggregate(r, s, true, [aggr]);
                }
            }

            if (custom) {
                for (i in custom) {
                    if (custom.hasOwnProperty(i)) {
                        custom[i](i, r, s);
                    }
                }
            }

        },

        _tmpl: function(main) {

            function BuiltClass() {
                BuiltClass.superclass.constructor.apply(this, arguments);
            }
            Y.extend(BuiltClass, main);

            return BuiltClass;
        },

        _impl : function(extClass) {
            var classes = this._getClasses(), i, l, cls, exts, ll, j;
            for (i = 0, l = classes.length; i < l; i++) {
                cls = classes[i];
                if (cls._yuibuild) {
                    exts = cls._yuibuild.exts;
                    ll = exts.length;

                    for (j = 0; j < ll; j++) {
                        if (exts[j] === extClass) {
                            return true;
                        }
                    }
                }
            }
            return false;
        },

        _ctor : function(main, cfg) {

           var dynamic = (cfg && false === cfg.dynamic) ? false : true,
               builtClass = (dynamic) ? build._tmpl(main) : main,
               buildCfg = builtClass._yuibuild;

            if (!buildCfg) {
                buildCfg = builtClass._yuibuild = {};
            }

            buildCfg.id = buildCfg.id || null;
            buildCfg.exts = buildCfg.exts || [];
            buildCfg.dynamic = dynamic;

            return builtClass;
        },

        _cfg : function(main, cfg, exts) {
            var aggr = [],
                cust = {},
                statics = [],
                buildCfg,
                cfgAggr = (cfg && cfg.aggregates),
                cfgCustBuild = (cfg && cfg.custom),
                cfgStatics = (cfg && cfg.statics),
                c = main,
                i,
                l;

            // Prototype Chain
            while (c && c.prototype) {
                buildCfg = c._buildCfg;
                if (buildCfg) {
                    if (buildCfg.aggregates) {
                        aggr = aggr.concat(buildCfg.aggregates);
                    }
                    if (buildCfg.custom) {
                        Y.mix(cust, buildCfg.custom, true);
                    }
                    if (buildCfg.statics) {
                        statics = statics.concat(buildCfg.statics);
                    }
                }
                c = c.superclass ? c.superclass.constructor : null;
            }

            // Exts
            if (exts) {
                for (i = 0, l = exts.length; i < l; i++) {
                    c = exts[i];
                    buildCfg = c._buildCfg;
                    if (buildCfg) {
                        if (buildCfg.aggregates) {
                            aggr = aggr.concat(buildCfg.aggregates);
                        }
                        if (buildCfg.custom) {
                            Y.mix(cust, buildCfg.custom, true);
                        }
                        if (buildCfg.statics) {
                            statics = statics.concat(buildCfg.statics);
                        }
                    }
                }
            }

            if (cfgAggr) {
                aggr = aggr.concat(cfgAggr);
            }

            if (cfgCustBuild) {
                Y.mix(cust, cfg.cfgBuild, true);
            }

            if (cfgStatics) {
                statics = statics.concat(cfgStatics);
            }

            return {
                aggregates: aggr,
                custom: cust,
                statics: statics
            };
        },

        _clean : function(sx, cfg) {
            var prop, i, l, sxclone = Y.merge(sx),
                aggregates = cfg.aggregates,
                custom = cfg.custom;

            for (prop in custom) {
                if (sxclone.hasOwnProperty(prop)) {
                    delete sxclone[prop];
                }
            }

            for (i = 0, l = aggregates.length; i < l; i++) {
                prop = aggregates[i];
                if (sxclone.hasOwnProperty(prop)) {
                    delete sxclone[prop];
                }
            }

            return sxclone;
        }
    });

    /**
     * <p>
     * Builds a custom constructor function (class) from the
     * main function, and array of extension functions (classes)
     * provided. The NAME field for the constructor function is
     * defined by the first argument passed in.
     * </p>
     * <p>
     * The cfg object supports the following properties
     * </p>
     * <dl>
     *    <dt>dynamic &#60;boolean&#62;</dt>
     *    <dd>
     *    <p>If true (default), a completely new class
     *    is created which extends the main class, and acts as the
     *    host on which the extension classes are augmented.</p>
     *    <p>If false, the extensions classes are augmented directly to
     *    the main class, modifying the main class' prototype.</p>
     *    </dd>
     *    <dt>aggregates &#60;String[]&#62;</dt>
     *    <dd>An array of static property names, which will get aggregated
     *    on to the built class, in addition to the default properties build
     *    will always aggregate as defined by the main class' static _buildCfg
     *    property.
     *    </dd>
     * </dl>
     *
     * @method build
     * @deprecated Use the more convenient Base.create and Base.mix methods instead
     * @static
     * @param {Function} name The name of the new class. Used to define the NAME property for the new class.
     * @param {Function} main The main class on which to base the built class
     * @param {Function[]} extensions The set of extension classes which will be
     * augmented/aggregated to the built class.
     * @param {Object} cfg Optional. Build configuration for the class (see description).
     * @return {Function} A custom class, created from the provided main and extension classes
     */
    Base.build = function(name, main, extensions, cfg) {
        return build(name, main, extensions, null, null, cfg);
    };

    /**
     * Creates a new class (constructor function) which extends the base class passed in as the second argument,
     * and mixes in the array of extensions provided.
     *
     * Prototype properties or methods can be added to the new class, using the px argument (similar to Y.extend).
     *
     * Static properties or methods can be added to the new class, using the sx argument (similar to Y.extend).
     *
     * **NOTE FOR COMPONENT DEVELOPERS**: Both the `base` class, and `extensions` can define static a `_buildCfg`
     * property, which acts as class creation meta-data, and drives how special static properties from the base
     * class, or extensions should be copied, aggregated or (custom) mixed into the newly created class.
     *
     * The `_buildCfg` property is a hash with 3 supported properties: `statics`, `aggregates` and `custom`, e.g:
     *
     *     // If the Base/Main class is the thing introducing the property:
     *
     *     MyBaseClass._buildCfg = {
     *
     *        // Static properties/methods to copy (Alias) to the built class.
     *        statics: ["CopyThisMethod", "CopyThisProperty"],
     *
     *        // Static props to aggregate onto the built class.
     *        aggregates: ["AggregateThisProperty"],
     *
     *        // Static properties which need custom handling (e.g. deep merge etc.)
     *        custom: {
     *           "CustomProperty" : function(property, Receiver, Supplier) {
     *              ...
     *              var triggers = Receiver.CustomProperty.triggers;
     *              Receiver.CustomProperty.triggers = triggers.concat(Supplier.CustomProperty.triggers);
     *              ...
     *           }
     *        }
     *     };
     *
     *     MyBaseClass.CopyThisMethod = function() {...};
     *     MyBaseClass.CopyThisProperty = "foo";
     *     MyBaseClass.AggregateThisProperty = {...};
     *     MyBaseClass.CustomProperty = {
     *        triggers: [...]
     *     }
     *
     *     // Or, if the Extension is the thing introducing the property:
     *
     *     MyExtension._buildCfg = {
     *         statics : ...
     *         aggregates : ...
     *         custom : ...
     *     }
     *
     * This way, when users pass your base or extension class to `Y.Base.create` or `Y.Base.mix`, they don't need to
     * know which properties need special handling. `Y.Base` has a buildCfg which defines `ATTRS` for custom mix handling
     * (to protect the static config objects), and `Y.Widget` has a buildCfg which specifies `HTML_PARSER` for
     * straight up aggregation.
     *
     * @method create
     * @static
     * @param {String} name The name of the newly created class. Used to define the NAME property for the new class.
     * @param {Function} main The base class which the new class should extend.
     * This class needs to be Base or a class derived from base (e.g. Widget).
     * @param {Function[]} extensions The list of extensions which will be mixed into the built class.
     * @param {Object} px The set of prototype properties/methods to add to the built class.
     * @param {Object} sx The set of static properties/methods to add to the built class.
     * @return {Function} The newly created class.
     */
    Base.create = function(name, base, extensions, px, sx) {
        return build(name, base, extensions, px, sx);
    };

    /**
     * <p>Mixes in a list of extensions to an existing class.</p>
     * @method mix
     * @static
     * @param {Function} main The existing class into which the extensions should be mixed.
     * The class needs to be Base or a class derived from Base (e.g. Widget)
     * @param {Function[]} extensions The set of extension classes which will mixed into the existing main class.
     * @return {Function} The modified main class, with extensions mixed in.
     */
    Base.mix = function(main, extensions) {

        if (main._CACHED_CLASS_DATA) {
            main._CACHED_CLASS_DATA = null;
        }

        return build(null, main, extensions, null, null, {dynamic:false});
    };

    /**
     * The build configuration for the Base class.
     *
     * Defines the static fields which need to be aggregated when the Base class
     * is used as the main class passed to the
     * <a href="#method_Base.build">Base.build</a> method.
     *
     * @property _buildCfg
     * @type Object
     * @static
     * @final
     * @private
     */
    BaseCore._buildCfg = {
        aggregates: AGGREGATES.concat(),

        custom: {
            ATTRS         : attrsAggregator,
            _ATTR_CFG     : attrCfgAggregator,
            _NON_ATTRS_CFG: arrayAggregator
        }
    };

    // Makes sure Base and BaseCore use separate `_buildCfg` objects.
    Base._buildCfg = {
        aggregates: AGGREGATES.concat(),

        custom: {
            ATTRS         : attrsAggregator,
            _ATTR_CFG     : attrCfgAggregator,
            _NON_ATTRS_CFG: arrayAggregator
        }
    };


}, '3.17.1', {"requires": ["base-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('escape', function (Y, NAME) {

/**
Provides utility methods for escaping strings.

@module escape
@class Escape
@static
@since 3.3.0
**/

var HTML_CHARS = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;'
    },

Escape = {
    // -- Public Static Methods ------------------------------------------------

    /**
    Returns a copy of the specified string with special HTML characters
    escaped. The following characters will be converted to their
    corresponding character entities:

        & < > " ' / `

    This implementation is based on the [OWASP HTML escaping
    recommendations][1]. In addition to the characters in the OWASP
    recommendations, we also escape the <code>&#x60;</code> character, since IE
    interprets it as an attribute delimiter.

    If _string_ is not already a string, it will be coerced to a string.

    [1]: http://www.owasp.org/index.php/XSS_(Cross_Site_Scripting)_Prevention_Cheat_Sheet

    @method html
    @param {String} string String to escape.
    @return {String} Escaped string.
    @static
    **/
    html: function (string) {
        return (string + '').replace(/[&<>"'\/`]/g, Escape._htmlReplacer);
    },

    /**
    Returns a copy of the specified string with special regular expression
    characters escaped, allowing the string to be used safely inside a regex.
    The following characters, and all whitespace characters, are escaped:

        - $ ^ * ( ) + [ ] { } | \ , . ?

    If _string_ is not already a string, it will be coerced to a string.

    @method regex
    @param {String} string String to escape.
    @return {String} Escaped string.
    @static
    **/
    regex: function (string) {
        // There's no need to escape !, =, and : since they only have meaning
        // when they follow a parenthesized ?, as in (?:...), and we already
        // escape parens and question marks.
        return (string + '').replace(/[\-$\^*()+\[\]{}|\\,.?\s]/g, '\\$&');
    },

    // -- Protected Static Methods ---------------------------------------------

    /**
     * Regex replacer for HTML escaping.
     *
     * @method _htmlReplacer
     * @param {String} match Matched character (must exist in HTML_CHARS).
     * @return {String} HTML entity.
     * @static
     * @protected
     */
    _htmlReplacer: function (match) {
        return HTML_CHARS[match];
    }
};

Escape.regexp = Escape.regex;

Y.Escape = Escape;


}, '3.17.1', {"requires": ["yui-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('button-core', function (Y, NAME) {

/**
 * Provides an interface for working with button-like DOM nodes
 *
 * @module button-core
 * @since 3.5.0
 */
var getClassName = Y.ClassNameManager.getClassName,
    AttributeCore = Y.AttributeCore;

/**
 * Creates a button
 *
 * @class ButtonCore
 * @uses AttributeCore
 * @param config {Object} Configuration object
 * @constructor
 */
function ButtonCore(config) {
    this.initializer(config);
}

ButtonCore.prototype = {

    /**
     *
     * @property TEMPLATE
     * @type {String}
     * @default <button/>
     */
    TEMPLATE: '<button/>',

    /**
     *
     * @property constructor
     * @type {Object}
     * @default ButtonCore
     * @private
     */
    constructor: ButtonCore,

    /**
     * @method initializer
     * @description Internal init() handler.
     * @param config {Object} Config object.
     * @private
     */
    initializer: function(config) {
        this._initNode(config);
        this._initAttributes(config);
        this._renderUI(config);
    },

    /**
     * @method _initNode
     * @description Node initializer
     * @param config {Object} Config object.
     * @private
     */
    _initNode: function(config) {
        if (config.host) {
            this._host = Y.one(config.host);
        } else {
            this._host = Y.Node.create(this.TEMPLATE);
        }
    },

    /**
     * @method _initAttributes
     * @description  Attribute initializer
     * @param config {Object} Config object.
     * @private
     */
    _initAttributes: function(config) {
        AttributeCore.call(this, ButtonCore.ATTRS, config);
    },

    /**
     * @method renderUI
     * @description Renders any UI/DOM elements for Button instances
     * @param config {Object} Config object.
     * @private
     */
    _renderUI: function() {
        var node = this.getNode(),
            nodeName = node.get('nodeName').toLowerCase();

        // Set some default node attributes
        node.addClass(ButtonCore.CLASS_NAMES.BUTTON);

        if (nodeName !== 'button' && nodeName !== 'input') {
            node.set('role', 'button');
        }
    },

    /**
     * @method enable
     * @description Sets the button's `disabled` DOM attribute to `false`
     * @public
     */
    enable: function() {
        this.set('disabled', false);
    },

    /**
     * @method disable
     * @description Sets the button's `disabled` DOM attribute to `true`
     * @public
     */
    disable: function() {
        this.set('disabled', true);
    },

    /**
     * @method getNode
     * @description Gets the button's host node
     * @return {Node} The host node instance
     * @public
     */
    getNode: function() {
        if (!this._host) {
            // If this._host doesn't exist, that means this._initNode
            // was never executed, meaning this is likely a Widget and
            // the host node should point to the boundingBox.
            this._host = this.get('boundingBox');
        }

        return this._host;
    },

    /**
     * @method _getLabel
     * @description Getter for a button's `label` ATTR
     * @return {String} The text label of the button
     * @private
     */
    _getLabel: function () {
        var node = this.getNode(),
            label = ButtonCore._getTextLabelFromNode(node);

        return label;
    },

    /**
     * @method _getLabelHTML
     * @description Getter for a button's `labelHTML` ATTR
     * @return {String} The HTML label of the button
     * @private
     */
    _getLabelHTML: function () {
        var node = this.getNode(),
            labelHTML = ButtonCore._getHTMLFromNode(node);

        return labelHTML;
    },

    /**
     * @method _setLabel
     * @description Setter for a button's `label` ATTR
     * @param value {String} The value to set for `label`
     * @param name {String} The name of this ATTR (`label`)
     * @param opts {Object} Additional options
     *    @param opts.src {String} A string identifying the callee.
     *        `internal` will not sync this value with the `labelHTML` ATTR
     * @return {String} The text label for the given node
     * @private
     */
    _setLabel: function (value, name, opts) {
        var label = Y.Escape.html(value);

        if (!opts || opts.src !== 'internal') {
            this.set('labelHTML', label, {src: 'internal'});
        }

        return label;
    },

    /**
     * @method _setLabelHTML
     * @description Setter for a button's `labelHTML` ATTR
     * @param value {String} The value to set for `labelHTML`
     * @param name {String} The name of this ATTR (`labelHTML`)
     * @param opts {Object} Additional options
     *    @param opts.src {String} A string identifying the callee.
     *        `internal` will not sync this value with the `label` ATTR
     * @return {String} The HTML label for the given node
     * @private
     */
    _setLabelHTML: function (value, name, opts) {
        var node = this.getNode(),
            labelNode = ButtonCore._getLabelNodeFromParent(node),
            nodeName = node.get('nodeName').toLowerCase();

        if (nodeName === 'input') {
            labelNode.set('value', value);
        }
        else {
            labelNode.setHTML(value);
        }

        if (!opts || opts.src !== 'internal') {
            this.set('label', value, {src: 'internal'});
        }

        return value;
    },

    /**
     * @method _setDisabled
     * @description Setter for the `disabled` ATTR
     * @param value {boolean}
     * @private
     */
    _setDisabled: function(value) {
        var node = this.getNode();

        node.getDOMNode().disabled = value; // avoid rerunning setter when this === node
        node.toggleClass(ButtonCore.CLASS_NAMES.DISABLED, value);

        return value;
    }
};

// ButtonCore inherits from AttributeCore
Y.mix(ButtonCore.prototype, AttributeCore.prototype);

/**
 * Attribute configuration.
 *
 * @property ATTRS
 * @type {Object}
 * @protected
 * @static
 */
ButtonCore.ATTRS = {

    /**
     * The text of the button's label
     *
     * @config label
     * @type String
     */
    label: {
        setter: '_setLabel',
        getter: '_getLabel',
        lazyAdd: false
    },

    /**
     * The HTML of the button's label
     *
     * This attribute accepts HTML and inserts it into the DOM **without**
     * sanitization.  This attribute should only be used with HTML that has
     * either been escaped (using `Y.Escape.html`), or sanitized according to
     * the requirements of your application.
     *
     * If all you need is support for text labels, please use the `label`
     * attribute instead.
     *
     * @config labelHTML
     * @type HTML
     */
    labelHTML: {
        setter: '_setLabelHTML',
        getter: '_getLabelHTML',
        lazyAdd: false
    },

    /**
     * The button's enabled/disabled state
     *
     * @config disabled
     * @type Boolean
     */
    disabled: {
        value: false,
        setter: '_setDisabled',
        lazyAdd: false
    }
};

/**
 * Name of this component.
 *
 * @property NAME
 * @type String
 * @static
 */
ButtonCore.NAME = "button";

/**
 * Array of static constants used to identify the classnames applied to DOM nodes
 *
 * @property CLASS_NAMES
 * @type {Object}
 * @public
 * @static
 */
ButtonCore.CLASS_NAMES = {
    BUTTON  : getClassName('button'),
    DISABLED: getClassName('button', 'disabled'),
    SELECTED: getClassName('button', 'selected'),
    LABEL   : getClassName('button', 'label')
};

/**
 * Array of static constants used to for applying ARIA states
 *
 * @property ARIA_STATES
 * @type {Object}
 * @private
 * @static
 */
ButtonCore.ARIA_STATES = {
    PRESSED : 'aria-pressed',
    CHECKED : 'aria-checked'
};

/**
 * Array of static constants used to for applying ARIA roles
 *
 * @property ARIA_ROLES
 * @type {Object}
 * @private
 * @static
 */
ButtonCore.ARIA_ROLES = {
    BUTTON  : 'button',
    CHECKBOX: 'checkbox',
    TOGGLE  : 'toggle'
};

/**
 * Finds the label node within a button
 *
 * @method _getLabelNodeFromParent
 * @param node {Node} The parent node
 * @return {Node} The label node
 * @private
 * @static
 */
ButtonCore._getLabelNodeFromParent = function (node) {
    var labelNode = (node.one('.' + ButtonCore.CLASS_NAMES.LABEL) || node);

    return labelNode;
};

/**
 * Gets a text label from a node
 *
 * @method _getTextLabelFromNode
 * @param node {Node} The parent node
 * @return {String} The text label for a given node
 * @private
 * @static
 */
ButtonCore._getTextLabelFromNode = function (node) {
    var labelNode = ButtonCore._getLabelNodeFromParent(node),
        nodeName = labelNode.get('nodeName').toLowerCase(),
        label = labelNode.get(nodeName === 'input' ? 'value' : 'text');

    return label;
};

/**
 * A utility method that gets an HTML label from a given node
 *
 * @method _getHTMLFromNode
 * @param node {Node} The parent node
 * @return {String} The HTML label for a given node
 * @private
 * @static
 */
ButtonCore._getHTMLFromNode = function (node) {
    var labelNode = ButtonCore._getLabelNodeFromParent(node),
        label = labelNode.getHTML();

    return label;
};

/**
 * Gets the disabled attribute from a node
 *
 * @method _getDisabledFromNode
 * @param node {Node} The parent node
 * @return {boolean} The disabled state for a given node
 * @private
 * @static
 */
ButtonCore._getDisabledFromNode = function (node) {
    return node.get('disabled');
};

// Export ButtonCore
Y.ButtonCore = ButtonCore;


}, '3.17.1', {"requires": ["attribute-core", "classnamemanager", "node-base", "escape"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('button-plugin', function (Y, NAME) {

/**
* A Button Plugin
*
* @module button-plugin
* @since 3.5.0
*/

/**
* @class Button
* @param config {Object} Configuration object
* @extends ButtonCore
* @constructor
* @namespace Plugin
*/
function ButtonPlugin() {
    ButtonPlugin.superclass.constructor.apply(this, arguments);
}

Y.extend(ButtonPlugin, Y.ButtonCore, {

    /**
    * @method _afterNodeGet
    * @param name {string}
    * @private
    */
    _afterNodeGet: function (name) {
        // TODO: point to method (_uiSetLabel, etc) instead of getter/setter
        var ATTRS = this.constructor.ATTRS,
            fn = ATTRS[name] && ATTRS[name].getter && this[ATTRS[name].getter];

        if (fn) {
            return new Y.Do.AlterReturn('get ' + name, fn.call(this));
        }
    },

    /**
    * @method _afterNodeSet
    * @param name {String}
    * @param val {String}
    * @private
    */
    _afterNodeSet: function (name, val) {
        var ATTRS = this.constructor.ATTRS,
            fn = ATTRS[name] && ATTRS[name].setter && this[ATTRS[name].setter];

        if (fn) {
            fn.call(this, val);
        }
    },

    /**
    * @method _initNode
    * @param config {Object}
    * @private
    */
    _initNode: function(config) {
        var node = config.host;
        this._host = node;

        Y.Do.after(this._afterNodeGet, node, 'get', this);
        Y.Do.after(this._afterNodeSet, node, 'set', this);
    },

    /**
    * @method destroy
    * @private
    */
    destroy: function(){
        // Nothing to do, but things are happier with it here
    }

}, {

    /**
    * Attribute configuration.
    *
    * @property ATTRS
    * @type {Object}
    * @private
    * @static
    */
    ATTRS: Y.merge(Y.ButtonCore.ATTRS),

    /**
    * Name of this component.
    *
    * @property NAME
    * @type String
    * @static
    */
    NAME: 'buttonPlugin',

    /**
    * Namespace of this component.
    *
    * @property NS
    * @type String
    * @static
    */
    NS: 'button'

});

/**
* @method createNode
* @description A factory that plugs a Y.Node instance with Y.Plugin.Button
* @param node {Object}
* @param config {Object}
* @return {Object} A plugged Y.Node instance
* @public
*/
ButtonPlugin.createNode = function(node, config) {
    var template;

    if (node && !config) {
        if (! (node.nodeType || node.getDOMNode || typeof node === 'string')) {
            config = node;
            node = config.srcNode;
        }
    }

    config   = config || {};
    template = config.template || Y.Plugin.Button.prototype.TEMPLATE;
    node     = node || config.srcNode || Y.DOM.create(template);

    return Y.one(node).plug(Y.Plugin.Button, config);
};

Y.namespace('Plugin').Button = ButtonPlugin;


}, '3.17.1', {"requires": ["button-core", "cssbutton", "node-pluginhost"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-stdmod', function (Y, NAME) {

/**
 * Provides standard module support for Widgets through an extension.
 *
 * @module widget-stdmod
 */
    var L = Y.Lang,
        Node = Y.Node,
        UA = Y.UA,
        Widget = Y.Widget,

        EMPTY = "",
        HD = "hd",
        BD = "bd",
        FT = "ft",
        HEADER = "header",
        BODY = "body",
        FOOTER = "footer",
        FILL_HEIGHT = "fillHeight",
        STDMOD = "stdmod",

        NODE_SUFFIX = "Node",
        CONTENT_SUFFIX = "Content",

        FIRST_CHILD = "firstChild",
        CHILD_NODES = "childNodes",
        OWNER_DOCUMENT = "ownerDocument",

        CONTENT_BOX = "contentBox",

        HEIGHT = "height",
        OFFSET_HEIGHT = "offsetHeight",
        AUTO = "auto",

        HeaderChange = "headerContentChange",
        BodyChange = "bodyContentChange",
        FooterChange = "footerContentChange",
        FillHeightChange = "fillHeightChange",
        HeightChange = "heightChange",
        ContentUpdate = "contentUpdate",

        RENDERUI = "renderUI",
        BINDUI = "bindUI",
        SYNCUI = "syncUI",

        APPLY_PARSED_CONFIG = "_applyParsedConfig",

        UI = Y.Widget.UI_SRC;

    /**
     * Widget extension, which can be used to add Standard Module support to the
     * base Widget class, through the <a href="Base.html#method_build">Base.build</a>
     * method.
     * <p>
     * The extension adds header, body and footer sections to the Widget's content box and
     * provides the corresponding methods and attributes to modify the contents of these sections.
     * </p>
     * @class WidgetStdMod
     * @param {Object} The user configuration object
     */
    function StdMod(config) {}

    /**
     * Constant used to refer the the standard module header, in methods which expect a section specifier
     *
     * @property HEADER
     * @static
     * @type String
     */
    StdMod.HEADER = HEADER;

    /**
     * Constant used to refer the the standard module body, in methods which expect a section specifier
     *
     * @property BODY
     * @static
     * @type String
     */
    StdMod.BODY = BODY;

    /**
     * Constant used to refer the the standard module footer, in methods which expect a section specifier
     *
     * @property FOOTER
     * @static
     * @type String
     */
    StdMod.FOOTER = FOOTER;

    /**
     * Constant used to specify insertion position, when adding content to sections of the standard module in
     * methods which expect a "where" argument.
     * <p>
     * Inserts new content <em>before</em> the sections existing content.
     * </p>
     * @property AFTER
     * @static
     * @type String
     */
    StdMod.AFTER = "after";

    /**
     * Constant used to specify insertion position, when adding content to sections of the standard module in
     * methods which expect a "where" argument.
     * <p>
     * Inserts new content <em>before</em> the sections existing content.
     * </p>
     * @property BEFORE
     * @static
     * @type String
     */
    StdMod.BEFORE = "before";
    /**
     * Constant used to specify insertion position, when adding content to sections of the standard module in
     * methods which expect a "where" argument.
     * <p>
     * <em>Replaces</em> the sections existing content, with new content.
     * </p>
     * @property REPLACE
     * @static
     * @type String
     */
    StdMod.REPLACE = "replace";

    var STD_HEADER = StdMod.HEADER,
        STD_BODY = StdMod.BODY,
        STD_FOOTER = StdMod.FOOTER,

        HEADER_CONTENT = STD_HEADER + CONTENT_SUFFIX,
        FOOTER_CONTENT = STD_FOOTER + CONTENT_SUFFIX,
        BODY_CONTENT = STD_BODY + CONTENT_SUFFIX;

    /**
     * Static property used to define the default attribute
     * configuration introduced by WidgetStdMod.
     *
     * @property ATTRS
     * @type Object
     * @static
     */
    StdMod.ATTRS = {

        /**
         * @attribute headerContent
         * @type HTML
         * @default undefined
         * @description The content to be added to the header section. This will replace any existing content
         * in the header. If you want to append, or insert new content, use the <a href="#method_setStdModContent">setStdModContent</a> method.
         */
        headerContent: {
            value:null
        },

        /**
         * @attribute footerContent
         * @type HTML
         * @default undefined
         * @description The content to be added to the footer section. This will replace any existing content
         * in the footer. If you want to append, or insert new content, use the <a href="#method_setStdModContent">setStdModContent</a> method.
         */
        footerContent: {
            value:null
        },

        /**
         * @attribute bodyContent
         * @type HTML
         * @default undefined
         * @description The content to be added to the body section. This will replace any existing content
         * in the body. If you want to append, or insert new content, use the <a href="#method_setStdModContent">setStdModContent</a> method.
         */
        bodyContent: {
            value:null
        },

        /**
         * @attribute fillHeight
         * @type {String}
         * @default WidgetStdMod.BODY
         * @description The section (WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER) which should be resized to fill the height of the standard module, when a
         * height is set on the Widget. If a height is not set on the widget, then all sections are sized based on
         * their content.
         */
        fillHeight: {
            value: StdMod.BODY,
            validator: function(val) {
                 return this._validateFillHeight(val);
            }
        }
    };

    /**
     * The HTML parsing rules for the WidgetStdMod class.
     *
     * @property HTML_PARSER
     * @static
     * @type Object
     */
    StdMod.HTML_PARSER = {
        headerContent: function(contentBox) {
            return this._parseStdModHTML(STD_HEADER);
        },

        bodyContent: function(contentBox) {
            return this._parseStdModHTML(STD_BODY);
        },

        footerContent : function(contentBox) {
            return this._parseStdModHTML(STD_FOOTER);
        }
    };

    /**
     * Static hash of default class names used for the header,
     * body and footer sections of the standard module, keyed by
     * the section identifier (WidgetStdMod.STD_HEADER, WidgetStdMod.STD_BODY, WidgetStdMod.STD_FOOTER)
     *
     * @property SECTION_CLASS_NAMES
     * @static
     * @type Object
     */
    StdMod.SECTION_CLASS_NAMES = {
        header: Widget.getClassName(HD),
        body: Widget.getClassName(BD),
        footer: Widget.getClassName(FT)
    };

    /**
     * The template HTML strings for each of the standard module sections. Section entries are keyed by the section constants,
     * WidgetStdMod.HEADER, WidgetStdMod.BODY, WidgetStdMod.FOOTER, and contain the HTML to be added for each section.
     * e.g.
     * <pre>
     *    {
     *       header : '&lt;div class="yui-widget-hd"&gt;&lt;/div&gt;',
     *       body : '&lt;div class="yui-widget-bd"&gt;&lt;/div&gt;',
     *       footer : '&lt;div class="yui-widget-ft"&gt;&lt;/div&gt;'
     *    }
     * </pre>
     * @property TEMPLATES
     * @type Object
     * @static
     */
    StdMod.TEMPLATES = {
        header : '<div class="' + StdMod.SECTION_CLASS_NAMES[STD_HEADER] + '"></div>',
        body : '<div class="' + StdMod.SECTION_CLASS_NAMES[STD_BODY] + '"></div>',
        footer : '<div class="' + StdMod.SECTION_CLASS_NAMES[STD_FOOTER] + '"></div>'
    };

    StdMod.prototype = {

        initializer : function() {
            this._stdModNode = this.get(CONTENT_BOX);

            Y.before(this._renderUIStdMod, this, RENDERUI);
            Y.before(this._bindUIStdMod, this, BINDUI);
            Y.before(this._syncUIStdMod, this, SYNCUI);
        },

        /**
         * Synchronizes the UI to match the Widgets standard module state.
         * <p>
         * This method is invoked after syncUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _syncUIStdMod
         * @protected
         */
        _syncUIStdMod : function() {
            var stdModParsed = this._stdModParsed;

            if (!stdModParsed || !stdModParsed[HEADER_CONTENT]) {
                this._uiSetStdMod(STD_HEADER, this.get(HEADER_CONTENT));
            }

            if (!stdModParsed || !stdModParsed[BODY_CONTENT]) {
                this._uiSetStdMod(STD_BODY, this.get(BODY_CONTENT));
            }

            if (!stdModParsed || !stdModParsed[FOOTER_CONTENT]) {
                this._uiSetStdMod(STD_FOOTER, this.get(FOOTER_CONTENT));
            }

            this._uiSetFillHeight(this.get(FILL_HEIGHT));
        },

        /**
         * Creates/Initializes the DOM for standard module support.
         * <p>
         * This method is invoked after renderUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _renderUIStdMod
         * @protected
         */
        _renderUIStdMod : function() {
            this._stdModNode.addClass(Widget.getClassName(STDMOD));
            this._renderStdModSections();

            //This normally goes in bindUI but in order to allow setStdModContent() to work before renderUI
            //stage, these listeners should be set up at the earliest possible time.
            this.after(HeaderChange, this._afterHeaderChange);
            this.after(BodyChange, this._afterBodyChange);
            this.after(FooterChange, this._afterFooterChange);
        },

        _renderStdModSections : function() {
            if (L.isValue(this.get(HEADER_CONTENT))) { this._renderStdMod(STD_HEADER); }
            if (L.isValue(this.get(BODY_CONTENT))) { this._renderStdMod(STD_BODY); }
            if (L.isValue(this.get(FOOTER_CONTENT))) { this._renderStdMod(STD_FOOTER); }
        },

        /**
         * Binds event listeners responsible for updating the UI state in response to
         * Widget standard module related state changes.
         * <p>
         * This method is invoked after bindUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _bindUIStdMod
         * @protected
         */
        _bindUIStdMod : function() {
            // this.after(HeaderChange, this._afterHeaderChange);
            // this.after(BodyChange, this._afterBodyChange);
            // this.after(FooterChange, this._afterFooterChange);

            this.after(FillHeightChange, this._afterFillHeightChange);
            this.after(HeightChange, this._fillHeight);
            this.after(ContentUpdate, this._fillHeight);
        },

        /**
         * Default attribute change listener for the headerContent attribute, responsible
         * for updating the UI, in response to attribute changes.
         *
         * @method _afterHeaderChange
         * @protected
         * @param {EventFacade} e The event facade for the attribute change
         */
        _afterHeaderChange : function(e) {
            if (e.src !== UI) {
                this._uiSetStdMod(STD_HEADER, e.newVal, e.stdModPosition);
            }
        },

        /**
         * Default attribute change listener for the bodyContent attribute, responsible
         * for updating the UI, in response to attribute changes.
         *
         * @method _afterBodyChange
         * @protected
         * @param {EventFacade} e The event facade for the attribute change
         */
        _afterBodyChange : function(e) {
            if (e.src !== UI) {
                this._uiSetStdMod(STD_BODY, e.newVal, e.stdModPosition);
            }
        },

        /**
         * Default attribute change listener for the footerContent attribute, responsible
         * for updating the UI, in response to attribute changes.
         *
         * @method _afterFooterChange
         * @protected
         * @param {EventFacade} e The event facade for the attribute change
         */
        _afterFooterChange : function(e) {
            if (e.src !== UI) {
                this._uiSetStdMod(STD_FOOTER, e.newVal, e.stdModPosition);
            }
        },

        /**
         * Default attribute change listener for the fillHeight attribute, responsible
         * for updating the UI, in response to attribute changes.
         *
         * @method _afterFillHeightChange
         * @protected
         * @param {EventFacade} e The event facade for the attribute change
         */
        _afterFillHeightChange: function (e) {
            this._uiSetFillHeight(e.newVal);
        },

        /**
         * Default validator for the fillHeight attribute. Verifies that the
         * value set is a valid section specifier - one of WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER,
         * or a falsey value if fillHeight is to be disabled.
         *
         * @method _validateFillHeight
         * @protected
         * @param {String} val The section which should be setup to fill height, or false/null to disable fillHeight
         * @return true if valid, false if not
         */
        _validateFillHeight : function(val) {
            return !val || val == StdMod.BODY || val == StdMod.HEADER || val == StdMod.FOOTER;
        },

        /**
         * Updates the rendered UI, to resize the provided section so that the standard module fills out
         * the specified widget height. Note: This method does not check whether or not a height is set
         * on the Widget.
         *
         * @method _uiSetFillHeight
         * @protected
         * @param {String} fillSection A valid section specifier - one of WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER
         */
        _uiSetFillHeight : function(fillSection) {
            var fillNode = this.getStdModNode(fillSection);
            var currNode = this._currFillNode;

            if (currNode && fillNode !== currNode){
                currNode.setStyle(HEIGHT, EMPTY);
            }

            if (fillNode) {
                this._currFillNode = fillNode;
            }

            this._fillHeight();
        },

        /**
         * Updates the rendered UI, to resize the current section specified by the fillHeight attribute, so
         * that the standard module fills out the Widget height. If a height has not been set on Widget,
         * the section is not resized (height is set to "auto").
         *
         * @method _fillHeight
         * @private
         */
        _fillHeight : function() {
            if (this.get(FILL_HEIGHT)) {
                var height = this.get(HEIGHT);
                if (height != EMPTY && height != AUTO) {
                    this.fillHeight(this.getStdModNode(this.get(FILL_HEIGHT)));
                }
            }
        },

        /**
         * Updates the rendered UI, adding the provided content (either an HTML string, or node reference),
         * to the specified section. The content is either added before, after or replaces existing content
         * in the section, based on the value of the <code>where</code> argument.
         *
         * @method _uiSetStdMod
         * @protected
         *
         * @param {String} section The section to be updated. Either WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER.
         * @param {String | Node} content The new content (either as an HTML string, or Node reference) to add to the section
         * @param {String} where Optional. Either WidgetStdMod.AFTER, WidgetStdMod.BEFORE or WidgetStdMod.REPLACE.
         * If not provided, the content will replace existing content in the section.
         */
        _uiSetStdMod : function(section, content, where) {
            // Using isValue, so that "" is valid content
            if (L.isValue(content)) {
                var node = this.getStdModNode(section, true);

                this._addStdModContent(node, content, where);

                this.set(section + CONTENT_SUFFIX, this._getStdModContent(section), {src:UI});
            } else {
                this._eraseStdMod(section);
            }
            this.fire(ContentUpdate);
        },

        /**
         * Creates the DOM node for the given section, and inserts it into the correct location in the contentBox.
         *
         * @method _renderStdMod
         * @protected
         * @param {String} section The section to create/render. Either WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER.
         * @return {Node} A reference to the added section node
         */
        _renderStdMod : function(section) {

            var contentBox = this.get(CONTENT_BOX),
                sectionNode = this._findStdModSection(section);

            if (!sectionNode) {
                sectionNode = this._getStdModTemplate(section);
            }

            this._insertStdModSection(contentBox, section, sectionNode);

            this[section + NODE_SUFFIX] = sectionNode;
            return this[section + NODE_SUFFIX];
        },

        /**
         * Removes the DOM node for the given section.
         *
         * @method _eraseStdMod
         * @protected
         * @param {String} section The section to remove. Either WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER.
         */
        _eraseStdMod : function(section) {
            var sectionNode = this.getStdModNode(section);
            if (sectionNode) {
                sectionNode.remove(true);
                delete this[section + NODE_SUFFIX];
            }
        },

        /**
         * Helper method to insert the Node for the given section into the correct location in the contentBox.
         *
         * @method _insertStdModSection
         * @private
         * @param {Node} contentBox A reference to the Widgets content box.
         * @param {String} section The section to create/render. Either WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER.
         * @param {Node} sectionNode The Node for the section.
         */
        _insertStdModSection : function(contentBox, section, sectionNode) {
            var fc = contentBox.get(FIRST_CHILD);

            if (section === STD_FOOTER || !fc) {
                contentBox.appendChild(sectionNode);
            } else {
                if (section === STD_HEADER) {
                    contentBox.insertBefore(sectionNode, fc);
                } else {
                    var footer = this[STD_FOOTER + NODE_SUFFIX];
                    if (footer) {
                        contentBox.insertBefore(sectionNode, footer);
                    } else {
                        contentBox.appendChild(sectionNode);
                    }
                }
            }
        },

        /**
         * Gets a new Node reference for the given standard module section, by cloning
         * the stored template node.
         *
         * @method _getStdModTemplate
         * @protected
         * @param {String} section The section to create a new node for. Either WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER.
         * @return {Node} The new Node instance for the section
         */
        _getStdModTemplate : function(section) {
            return Node.create(StdMod.TEMPLATES[section], this._stdModNode.get(OWNER_DOCUMENT));
        },

        /**
         * Helper method to add content to a StdMod section node.
         * The content is added either before, after or replaces the existing node content
         * based on the value of the <code>where</code> argument.
         *
         * @method _addStdModContent
         * @private
         *
         * @param {Node} node The section Node to be updated.
         * @param {Node|NodeList|String} children The new content Node, NodeList or String to be added to section Node provided.
         * @param {String} where Optional. Either WidgetStdMod.AFTER, WidgetStdMod.BEFORE or WidgetStdMod.REPLACE.
         * If not provided, the content will replace existing content in the Node.
         */
        _addStdModContent : function(node, children, where) {

            // StdMod where to Node where
            switch (where) {
                case StdMod.BEFORE:  // 0 is before fistChild
                    where = 0;
                    break;
                case StdMod.AFTER:   // undefined is appendChild
                    where = undefined;
                    break;
                default:            // replace is replace, not specified is replace
                    where = StdMod.REPLACE;
            }

            node.insert(children, where);
        },

        /**
         * Helper method to obtain the precise height of the node provided, including padding and border.
         * The height could be a sub-pixel value for certain browsers, such as Firefox 3.
         *
         * @method _getPreciseHeight
         * @private
         * @param {Node} node The node for which the precise height is required.
         * @return {Number} The height of the Node including borders and padding, possibly a float.
         */
        _getPreciseHeight : function(node) {
            var height = (node) ? node.get(OFFSET_HEIGHT) : 0,
                getBCR = "getBoundingClientRect";

            if (node && node.hasMethod(getBCR)) {
                var preciseRegion = node.invoke(getBCR);
                if (preciseRegion) {
                    height = preciseRegion.bottom - preciseRegion.top;
                }
            }

            return height;
        },

        /**
         * Helper method to to find the rendered node for the given section,
         * if it exists.
         *
         * @method _findStdModSection
         * @private
         * @param {String} section The section for which the render Node is to be found. Either WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER.
         * @return {Node} The rendered node for the given section, or null if not found.
         */
        _findStdModSection: function(section) {
            return this.get(CONTENT_BOX).one("> ." + StdMod.SECTION_CLASS_NAMES[section]);
        },

        /**
         * Utility method, used by WidgetStdMods HTML_PARSER implementation
         * to extract data for each section from markup.
         *
         * @method _parseStdModHTML
         * @private
         * @param {String} section
         * @return {String} Inner HTML string with the contents of the section
         */
        _parseStdModHTML : function(section) {

            var node = this._findStdModSection(section);

            if (node) {
                if (!this._stdModParsed) {
                    this._stdModParsed = {};
                    Y.before(this._applyStdModParsedConfig, this, APPLY_PARSED_CONFIG);
                }
                this._stdModParsed[section + CONTENT_SUFFIX] = 1;

                return node.get("innerHTML");
            }

            return null;
        },

        /**
         * This method is injected before the _applyParsedConfig step in
         * the application of HTML_PARSER, and sets up the state to
         * identify whether or not we should remove the current DOM content
         * or not, based on whether or not the current content attribute value
         * was extracted from the DOM, or provided by the user configuration
         *
         * @method _applyStdModParsedConfig
         * @private
         */
        _applyStdModParsedConfig : function(node, cfg, parsedCfg) {
            var parsed = this._stdModParsed;
            if (parsed) {
                parsed[HEADER_CONTENT] = !(HEADER_CONTENT in cfg) && (HEADER_CONTENT in parsed);
                parsed[BODY_CONTENT] = !(BODY_CONTENT in cfg) && (BODY_CONTENT in parsed);
                parsed[FOOTER_CONTENT] = !(FOOTER_CONTENT in cfg) && (FOOTER_CONTENT in parsed);
            }
        },

        /**
         * Retrieves the child nodes (content) of a standard module section
         *
         * @method _getStdModContent
         * @private
         * @param {String} section The standard module section whose child nodes are to be retrieved. Either WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER.
         * @return {Node} The child node collection of the standard module section.
         */
        _getStdModContent : function(section) {
            return (this[section + NODE_SUFFIX]) ? this[section + NODE_SUFFIX].get(CHILD_NODES) : null;
        },

        /**
         * Updates the body section of the standard module with the content provided (either an HTML string, or node reference).
         * <p>
         * This method can be used instead of the corresponding section content attribute if you'd like to retain the current content of the section,
         * and insert content before or after it, by specifying the <code>where</code> argument.
         * </p>
         * @method setStdModContent
         * @param {String} section The standard module section whose content is to be updated. Either WidgetStdMod.HEADER, WidgetStdMod.BODY or WidgetStdMod.FOOTER.
         * @param {String | Node} content The content to be added, either an HTML string or a Node reference.
         * @param {String} where Optional. Either WidgetStdMod.AFTER, WidgetStdMod.BEFORE or WidgetStdMod.REPLACE.
         * If not provided, the content will replace existing content in the section.
         */
        setStdModContent : function(section, content, where) {
            //var node = this.getStdModNode(section) || this._renderStdMod(section);
            this.set(section + CONTENT_SUFFIX, content, {stdModPosition:where});
            //this._addStdModContent(node, content, where);
        },

        /**
        Returns the node reference for the specified `section`.

        **Note:** The DOM is not queried for the node reference. The reference
        stored by the widget instance is returned if it was set. Passing a
        truthy for `forceCreate` will create the section node if it does not
        already exist.

        @method getStdModNode
        @param {String} section The section whose node reference is required.
            Either `WidgetStdMod.HEADER`, `WidgetStdMod.BODY`, or
            `WidgetStdMod.FOOTER`.
        @param {Boolean} forceCreate Whether the section node should be created
            if it does not already exist.
        @return {Node} The node reference for the `section`, or null if not set.
        **/
        getStdModNode : function(section, forceCreate) {
            var node = this[section + NODE_SUFFIX] || null;

            if (!node && forceCreate) {
                node = this._renderStdMod(section);
            }

            return node;
        },

        /**
         * Sets the height on the provided header, body or footer element to
         * fill out the height of the Widget. It determines the height of the
         * widgets bounding box, based on it's configured height value, and
         * sets the height of the provided section to fill out any
         * space remaining after the other standard module section heights
         * have been accounted for.
         *
         * <p><strong>NOTE:</strong> This method is not designed to work if an explicit
         * height has not been set on the Widget, since for an "auto" height Widget,
         * the heights of the header/body/footer will drive the height of the Widget.</p>
         *
         * @method fillHeight
         * @param {Node} node The node which should be resized to fill out the height
         * of the Widget bounding box. Should be a standard module section node which belongs
         * to the widget.
         */
        fillHeight : function(node) {
            if (node) {
                var contentBox = this.get(CONTENT_BOX),
                    stdModNodes = [this.headerNode, this.bodyNode, this.footerNode],
                    stdModNode,
                    cbContentHeight,
                    filled = 0,
                    remaining = 0,

                    validNode = false;

                for (var i = 0, l = stdModNodes.length; i < l; i++) {
                    stdModNode = stdModNodes[i];
                    if (stdModNode) {
                        if (stdModNode !== node) {
                            filled += this._getPreciseHeight(stdModNode);
                        } else {
                            validNode = true;
                        }
                    }
                }

                if (validNode) {
                    if (UA.ie || UA.opera) {
                        // Need to set height to 0, to allow height to be reduced
                        node.set(OFFSET_HEIGHT, 0);
                    }

                    cbContentHeight = contentBox.get(OFFSET_HEIGHT) -
                            parseInt(contentBox.getComputedStyle("paddingTop"), 10) -
                            parseInt(contentBox.getComputedStyle("paddingBottom"), 10) -
                            parseInt(contentBox.getComputedStyle("borderBottomWidth"), 10) -
                            parseInt(contentBox.getComputedStyle("borderTopWidth"), 10);

                    if (L.isNumber(cbContentHeight)) {
                        remaining = cbContentHeight - filled;
                        if (remaining >= 0) {
                            node.set(OFFSET_HEIGHT, remaining);
                        }
                    }
                }
            }
        }
    };

    Y.WidgetStdMod = StdMod;


}, '3.17.1', {"requires": ["base-build", "widget"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-buttons', function (Y, NAME) {

/**
Provides header/body/footer button support for Widgets that use the
`WidgetStdMod` extension.

@module widget-buttons
@since 3.4.0
**/

var YArray  = Y.Array,
    YLang   = Y.Lang,
    YObject = Y.Object,

    ButtonPlugin = Y.Plugin.Button,
    Widget       = Y.Widget,
    WidgetStdMod = Y.WidgetStdMod,

    getClassName = Y.ClassNameManager.getClassName,
    isArray      = YLang.isArray,
    isNumber     = YLang.isNumber,
    isString     = YLang.isString,
    isValue      = YLang.isValue;

// Utility to determine if an object is a Y.Node instance, even if it was
// created in a different YUI sandbox.
function isNode(node) {
    return !!node.getDOMNode;
}

/**
Provides header/body/footer button support for Widgets that use the
`WidgetStdMod` extension.

This Widget extension makes it easy to declaratively configure a widget's
buttons. It adds a `buttons` attribute along with button- accessor and mutator
methods. All button nodes have the `Y.Plugin.Button` plugin applied.

This extension also includes `HTML_PARSER` support to seed a widget's `buttons`
from those which already exist in its DOM.

@class WidgetButtons
@extensionfor Widget
@since 3.4.0
**/
function WidgetButtons() {
    // Has to be setup before the `initializer()`.
    this._buttonsHandles = {};
}

WidgetButtons.ATTRS = {
    /**
    Collection containing a widget's buttons.

    The collection is an Object which contains an Array of `Y.Node`s for every
    `WidgetStdMod` section (header, body, footer) which has one or more buttons.
    All button nodes have the `Y.Plugin.Button` plugin applied.

    This attribute is very flexible in the values it will accept. `buttons` can
    be specified as a single Array, or an Object of Arrays keyed to a particular
    section.

    All specified values will be normalized to this type of structure:

        {
            header: [...],
            footer: [...]
        }

    A button can be specified as a `Y.Node`, config Object, or String name for a
    predefined button on the `BUTTONS` prototype property. When a config Object
    is provided, it will be merged with any defaults provided by a button with
    the same `name` defined on the `BUTTONS` property.

    See `addButton()` for the detailed list of configuration properties.

    For convenience, a widget's buttons will always persist and remain rendered
    after header/body/footer content updates. Buttons should be removed by
    updating this attribute or using the `removeButton()` method.

    @example
        {
            // Uses predefined "close" button by string name.
            header: ['close'],

            footer: [
                {
                    name  : 'cancel',
                    label : 'Cancel',
                    action: 'hide'
                },

                {
                    name     : 'okay',
                    label    : 'Okay',
                    isDefault: true,

                    events: {
                        click: function (e) {
                            this.hide();
                        }
                    }
                }
            ]
        }

    @attribute buttons
    @type Object
    @default {}
    @since 3.4.0
    **/
    buttons: {
        getter: '_getButtons',
        setter: '_setButtons',
        value : {}
    },

    /**
    The current default button as configured through this widget's `buttons`.

    A button can be configured as the default button in the following ways:

      * As a config Object with an `isDefault` property:
        `{label: 'Okay', isDefault: true}`.

      * As a Node with a `data-default` attribute:
        `<button data-default="true">Okay</button>`.

    This attribute is **read-only**; anytime there are changes to this widget's
    `buttons`, the `defaultButton` will be updated if needed.

    **Note:** If two or more buttons are configured to be the default button,
    the last one wins.

    @attribute defaultButton
    @type Node
    @default null
    @readOnly
    @since 3.5.0
    **/
    defaultButton: {
        readOnly: true,
        value   : null
    }
};

/**
CSS classes used by `WidgetButtons`.

@property CLASS_NAMES
@type Object
@static
@since 3.5.0
**/
WidgetButtons.CLASS_NAMES = {
    button : getClassName('button'),
    buttons: Widget.getClassName('buttons'),
    primary: getClassName('button', 'primary')
};

WidgetButtons.HTML_PARSER = {
    buttons: function (srcNode) {
        return this._parseButtons(srcNode);
    }
};

/**
The list of button configuration properties which are specific to
`WidgetButtons` and should not be passed to `Y.Plugin.Button.createNode()`.

@property NON_BUTTON_NODE_CFG
@type Array
@static
@since 3.5.0
**/
WidgetButtons.NON_BUTTON_NODE_CFG = [
    'action', 'classNames', 'context', 'events', 'isDefault', 'section'
];

WidgetButtons.prototype = {
    // -- Public Properties ----------------------------------------------------

    /**
    Collection of predefined buttons mapped by name -> config.

    These button configurations will serve as defaults for any button added to a
    widget's buttons which have the same `name`.

    See `addButton()` for a list of possible configuration values.

    @property BUTTONS
    @type Object
    @default {}
    @see addButton()
    @since 3.5.0
    **/
    BUTTONS: {},

    /**
    The HTML template to use when creating the node which wraps all buttons of a
    section. By default it will have the CSS class: "yui3-widget-buttons".

    @property BUTTONS_TEMPLATE
    @type String
    @default "<span />"
    @since 3.5.0
    **/
    BUTTONS_TEMPLATE: '<span />',

    /**
    The default section to render buttons in when no section is specified.

    @property DEFAULT_BUTTONS_SECTION
    @type String
    @default Y.WidgetStdMod.FOOTER
    @since 3.5.0
    **/
    DEFAULT_BUTTONS_SECTION: WidgetStdMod.FOOTER,

    // -- Protected Properties -------------------------------------------------

    /**
    A map of button node `_yuid` -> event-handle for all button nodes which were
    created by this widget.

    @property _buttonsHandles
    @type Object
    @protected
    @since 3.5.0
    **/

    /**
    A map of this widget's `buttons`, both name -> button and
    section:name -> button.

    @property _buttonsMap
    @type Object
    @protected
    @since 3.5.0
    **/

    /**
    Internal reference to this widget's default button.

    @property _defaultButton
    @type Node
    @protected
    @since 3.5.0
    **/

    // -- Lifecycle Methods ----------------------------------------------------

    initializer: function () {
        // Require `Y.WidgetStdMod`.
        if (!this._stdModNode) {
            Y.error('WidgetStdMod must be added to a Widget before WidgetButtons.');
        }

        // Creates button mappings and sets the `defaultButton`.
        this._mapButtons(this.get('buttons'));
        this._updateDefaultButton();

        // Bound with `Y.bind()` to make more extensible.
        this.after({
            buttonsChange      : Y.bind('_afterButtonsChange', this),
            defaultButtonChange: Y.bind('_afterDefaultButtonChange', this)
        });

        Y.after(this._bindUIButtons, this, 'bindUI');
        Y.after(this._syncUIButtons, this, 'syncUI');
    },

    destructor: function () {
        // Detach all event subscriptions this widget added to its `buttons`.
        YObject.each(this._buttonsHandles, function (handle) {
            handle.detach();
        });

        delete this._buttonsHandles;
        delete this._buttonsMap;
        delete this._defaultButton;
    },

    // -- Public Methods -------------------------------------------------------

    /**
    Adds a button to this widget.

    The new button node will have the `Y.Plugin.Button` plugin applied, be added
    to this widget's `buttons`, and rendered in the specified `section` at the
    specified `index` (or end of the section when no `index` is provided). If
    the section does not exist, it will be created.

    This fires the `buttonsChange` event and adds the following properties to
    the event facade:

      * `button`: The button node or config object to add.

      * `section`: The `WidgetStdMod` section (header/body/footer) where the
        button will be added.

      * `index`: The index at which the button will be in the section.

      * `src`: "add"

    **Note:** The `index` argument will be passed to the Array `splice()`
    method, therefore a negative value will insert the `button` that many items
    from the end. The `index` property on the `buttonsChange` event facade is
    the index at which the `button` was added.

    @method addButton
    @param {Node|Object|String} button The button to add. This can be a `Y.Node`
        instance, config Object, or String name for a predefined button on the
        `BUTTONS` prototype property. When a config Object is provided, it will
        be merged with any defaults provided by any `srcNode` and/or a button
        with the same `name` defined on the `BUTTONS` property. The following
        are the possible configuration properties beyond what Node plugins
        accept by default:
      @param {Function|String} [button.action] The default handler that should
        be called when the button is clicked. A String name of a Function that
        exists on the `context` object can also be provided. **Note:**
        Specifying a set of `events` will override this setting.
      @param {String|String[]} [button.classNames] Additional CSS classes to add
        to the button node.
      @param {Object} [button.context=this] Context which any `events` or
        `action` should be called with. Defaults to `this`, the widget.
        **Note:** `e.target` will access the button node in the event handlers.
      @param {Boolean} [button.disabled=false] Whether the button should be
        disabled.
      @param {String|Object} [button.events="click"] Event name, or set of
        events and handlers to bind to the button node. **See:** `Y.Node.on()`,
        this value is passed as the first argument to `on()`.
      @param {Boolean} [button.isDefault=false] Whether the button is the
        default button.
      @param {String} [button.label] The visible text/value displayed in the
        button.
      @param {String} [button.name] A name which can later be used to reference
        this button. If a button is defined on the `BUTTONS` property with this
        same name, its configuration properties will be merged in as defaults.
      @param {String} [button.section] The `WidgetStdMod` section (header, body,
        footer) where the button should be added.
      @param {Node} [button.srcNode] An existing Node to use for the button,
        default values will be seeded from this node, but are overriden by any
        values specified in the config object. By default a new &lt;button&gt;
        node will be created.
      @param {String} [button.template] A specific template to use when creating
        a new button node (e.g. "&lt;a /&gt;"). **Note:** Specifying a `srcNode`
        will overide this.
    @param {String} [section="footer"] The `WidgetStdMod` section
        (header/body/footer) where the button should be added. This takes
        precedence over the `button.section` configuration property.
    @param {Number} [index] The index at which the button should be inserted. If
        not specified, the button will be added to the end of the section. This
        value is passed to the Array `splice()` method, therefore a negative
        value will insert the `button` that many items from the end.
    @chainable
    @see Plugin.Button.createNode()
    @since 3.4.0
    **/
    addButton: function (button, section, index) {
        var buttons = this.get('buttons'),
            sectionButtons, atIndex;

        // Makes sure we have the full config object.
        if (!isNode(button)) {
            button = this._mergeButtonConfig(button);
            section || (section = button.section);
        }

        section || (section = this.DEFAULT_BUTTONS_SECTION);
        sectionButtons = buttons[section] || (buttons[section] = []);
        isNumber(index) || (index = sectionButtons.length);

        // Insert new button at the correct position.
        sectionButtons.splice(index, 0, button);

        // Determine the index at which the `button` now exists in the array.
        atIndex = YArray.indexOf(sectionButtons, button);

        this.set('buttons', buttons, {
            button : button,
            section: section,
            index  : atIndex,
            src    : 'add'
        });

        return this;
    },

    /**
    Returns a button node from this widget's `buttons`.

    @method getButton
    @param {Number|String} name The string name or index of the button.
    @param {String} [section="footer"] The `WidgetStdMod` section
        (header/body/footer) where the button exists. Only applicable when
        looking for a button by numerical index, or by name but scoped to a
        particular section.
    @return {Node} The button node.
    @since 3.5.0
    **/
    getButton: function (name, section) {
        if (!isValue(name)) { return; }

        var map = this._buttonsMap,
            buttons;

        section || (section = this.DEFAULT_BUTTONS_SECTION);

        // Supports `getButton(1, 'header')` signature.
        if (isNumber(name)) {
            buttons = this.get('buttons');
            return buttons[section] && buttons[section][name];
        }

        // Looks up button by name or section:name.
        return arguments.length > 1 ? map[section + ':' + name] : map[name];
    },

    /**
    Removes a button from this widget.

    The button will be removed from this widget's `buttons` and its DOM. Any
    event subscriptions on the button which were created by this widget will be
    detached. If the content section becomes empty after removing the button
    node, then the section will also be removed.

    This fires the `buttonsChange` event and adds the following properties to
    the event facade:

      * `button`: The button node to remove.

      * `section`: The `WidgetStdMod` section (header/body/footer) where the
        button should be removed from.

      * `index`: The index at which the button exists in the section.

      * `src`: "remove"

    @method removeButton
    @param {Node|Number|String} button The button to remove. This can be a
        `Y.Node` instance, index, or String name of a button.
    @param {String} [section="footer"] The `WidgetStdMod` section
        (header/body/footer) where the button exists. Only applicable when
        removing a button by numerical index, or by name but scoped to a
        particular section.
    @chainable
    @since 3.5.0
    **/
    removeButton: function (button, section) {
        if (!isValue(button)) { return this; }

        var buttons = this.get('buttons'),
            index;

        // Shortcut if `button` is already an index which is needed for slicing.
        if (isNumber(button)) {
            section || (section = this.DEFAULT_BUTTONS_SECTION);
            index  = button;
            button = buttons[section][index];
        } else {
            // Supports `button` being the string name.
            if (isString(button)) {
                // `getButton()` is called this way because its behavior is
                // different based on the number of arguments.
                button = this.getButton.apply(this, arguments);
            }

            // Determines the `section` and `index` at which the button exists.
            YObject.some(buttons, function (sectionButtons, currentSection) {
                index = YArray.indexOf(sectionButtons, button);

                if (index > -1) {
                    section = currentSection;
                    return true;
                }
            });
        }

        // Button was found at an appropriate index.
        if (button && index > -1) {
            // Remove button from `section` array.
            buttons[section].splice(index, 1);

            this.set('buttons', buttons, {
                button : button,
                section: section,
                index  : index,
                src    : 'remove'
            });
        }

        return this;
    },

    // -- Protected Methods ----------------------------------------------------

    /**
    Binds UI event listeners. This method is inserted via AOP, and will execute
    after `bindUI()`.

    @method _bindUIButtons
    @protected
    @since 3.4.0
    **/
    _bindUIButtons: function () {
        // Event handlers are bound with `bind()` to make them more extensible.
        var afterContentChange = Y.bind('_afterContentChangeButtons', this);

        this.after({
            visibleChange      : Y.bind('_afterVisibleChangeButtons', this),
            headerContentChange: afterContentChange,
            bodyContentChange  : afterContentChange,
            footerContentChange: afterContentChange
        });
    },

    /**
    Returns a button node based on the specified `button` node or configuration.

    The button node will either be created via `Y.Plugin.Button.createNode()`,
    or when `button` is specified as a node already, it will by `plug()`ed with
    `Y.Plugin.Button`.

    @method _createButton
    @param {Node|Object} button Button node or configuration object.
    @return {Node} The button node.
    @protected
    @since 3.5.0
    **/
    _createButton: function (button) {
        var config, buttonConfig, nonButtonNodeCfg,
            i, len, action, context, handle;

        // Makes sure the exiting `Y.Node` instance is from this YUI sandbox and
        // is plugged with `Y.Plugin.Button`.
        if (isNode(button)) {
            return Y.one(button.getDOMNode()).plug(ButtonPlugin);
        }

        // Merge `button` config with defaults and back-compat.
        config = Y.merge({
            context: this,
            events : 'click',
            label  : button.value
        }, button);

        buttonConfig     = Y.merge(config);
        nonButtonNodeCfg = WidgetButtons.NON_BUTTON_NODE_CFG;

        // Remove all non-button Node config props.
        for (i = 0, len = nonButtonNodeCfg.length; i < len; i += 1) {
            delete buttonConfig[nonButtonNodeCfg[i]];
        }

        // Create the button node using the button Node-only config.
        button = ButtonPlugin.createNode(buttonConfig);

        context = config.context;
        action  = config.action;

        // Supports `action` as a String name of a Function on the `context`
        // object.
        if (isString(action)) {
            action = Y.bind(action, context);
        }

        // Supports all types of crazy configs for event subscriptions and
        // stores a reference to the returned `EventHandle`.
        handle = button.on(config.events, action, context);
        this._buttonsHandles[Y.stamp(button, true)] = handle;

        // Tags the button with the configured `name` and `isDefault` settings.
        button.setData('name', this._getButtonName(config));
        button.setData('default', this._getButtonDefault(config));

        // Add any CSS classnames to the button node.
        YArray.each(YArray(config.classNames), button.addClass, button);

        return button;
    },

    /**
    Returns the buttons container for the specified `section`, passing a truthy
    value for `create` will create the node if it does not already exist.

    **Note:** It is up to the caller to properly insert the returned container
    node into the content section.

    @method _getButtonContainer
    @param {String} section The `WidgetStdMod` section (header/body/footer).
    @param {Boolean} create Whether the buttons container should be created if
        it does not already exist.
    @return {Node} The buttons container node for the specified `section`.
    @protected
    @see BUTTONS_TEMPLATE
    @since 3.5.0
    **/
    _getButtonContainer: function (section, create) {
        var sectionClassName = WidgetStdMod.SECTION_CLASS_NAMES[section],
            buttonsClassName = WidgetButtons.CLASS_NAMES.buttons,
            contentBox       = this.get('contentBox'),
            containerSelector, container;

        // Search for an existing buttons container within the section.
        containerSelector = '.' + sectionClassName + ' .' + buttonsClassName;
        container         = contentBox.one(containerSelector);

        // Create the `container` if it doesn't already exist.
        if (!container && create) {
            container = Y.Node.create(this.BUTTONS_TEMPLATE);
            container.addClass(buttonsClassName);
        }

        return container;
    },

    /**
    Returns whether or not the specified `button` is configured to be the
    default button.

    When a button node is specified, the button's `getData()` method will be
    used to determine if the button is configured to be the default. When a
    button config object is specified, the `isDefault` prop will determine
    whether the button is the default.

    **Note:** `<button data-default="true"></button>` is supported via the
    `button.getData('default')` API call.

    @method _getButtonDefault
    @param {Node|Object} button The button node or configuration object.
    @return {Boolean} Whether the button is configured to be the default button.
    @protected
    @since 3.5.0
    **/
    _getButtonDefault: function (button) {
        var isDefault = isNode(button) ?
                button.getData('default') : button.isDefault;

        if (isString(isDefault)) {
            return isDefault.toLowerCase() === 'true';
        }

        return !!isDefault;
    },

    /**
    Returns the name of the specified `button`.

    When a button node is specified, the button's `getData('name')` method is
    preferred, but will fallback to `get('name')`, and the result will determine
    the button's name. When a button config object is specified, the `name` prop
    will determine the button's name.

    **Note:** `<button data-name="foo"></button>` is supported via the
    `button.getData('name')` API call.

    @method _getButtonName
    @param {Node|Object} button The button node or configuration object.
    @return {String} The name of the button.
    @protected
    @since 3.5.0
    **/
    _getButtonName: function (button) {
        var name;

        if (isNode(button)) {
            name = button.getData('name') || button.get('name');
        } else {
            name = button && (button.name || button.type);
        }

        return name;
    },

    /**
    Getter for the `buttons` attribute. A copy of the `buttons` object is
    returned so the stored state cannot be modified by the callers of
    `get('buttons')`.

    This will recreate a copy of the `buttons` object, and each section array
    (the button nodes are *not* copied/cloned.)

    @method _getButtons
    @param {Object} buttons The widget's current `buttons` state.
    @return {Object} A copy of the widget's current `buttons` state.
    @protected
    @since 3.5.0
    **/
    _getButtons: function (buttons) {
        var buttonsCopy = {};

        // Creates a new copy of the `buttons` object.
        YObject.each(buttons, function (sectionButtons, section) {
            // Creates of copy of the array of button nodes.
            buttonsCopy[section] = sectionButtons.concat();
        });

        return buttonsCopy;
    },

    /**
    Adds the specified `button` to the buttons map (both name -> button and
    section:name -> button), and sets the button as the default if it is
    configured as the default button.

    **Note:** If two or more buttons are configured with the same `name` and/or
    configured to be the default button, the last one wins.

    @method _mapButton
    @param {Node} button The button node to map.
    @param {String} section The `WidgetStdMod` section (header/body/footer).
    @protected
    @since 3.5.0
    **/
    _mapButton: function (button, section) {
        var map       = this._buttonsMap,
            name      = this._getButtonName(button),
            isDefault = this._getButtonDefault(button);

        if (name) {
            // name -> button
            map[name] = button;

            // section:name -> button
            map[section + ':' + name] = button;
        }

        isDefault && (this._defaultButton = button);
    },

    /**
    Adds the specified `buttons` to the buttons map (both name -> button and
    section:name -> button), and set the a button as the default if one is
    configured as the default button.

    **Note:** This will clear all previous button mappings and null-out any
    previous default button! If two or more buttons are configured with the same
    `name` and/or configured to be the default button, the last one wins.

    @method _mapButtons
    @param {Node[]} buttons The button nodes to map.
    @protected
    @since 3.5.0
    **/
    _mapButtons: function (buttons) {
        this._buttonsMap    = {};
        this._defaultButton = null;

        YObject.each(buttons, function (sectionButtons, section) {
            var i, len;

            for (i = 0, len = sectionButtons.length; i < len; i += 1) {
                this._mapButton(sectionButtons[i], section);
            }
        }, this);
    },

    /**
    Returns a copy of the specified `config` object merged with any defaults
    provided by a `srcNode` and/or a predefined configuration for a button
    with the same `name` on the `BUTTONS` property.

    @method _mergeButtonConfig
    @param {Object|String} config Button configuration object, or string name.
    @return {Object} A copy of the button configuration object merged with any
        defaults.
    @protected
    @since 3.5.0
    **/
    _mergeButtonConfig: function (config) {
        var buttonConfig, defConfig, name, button, tagName, label;

        // Makes sure `config` is an Object and a copy of the specified value.
        config = isString(config) ? {name: config} : Y.merge(config);

        // Seeds default values from the button node, if there is one.
        if (config.srcNode) {
            button  = config.srcNode;
            tagName = button.get('tagName').toLowerCase();
            label   = button.get(tagName === 'input' ? 'value' : 'text');

            // Makes sure the button's current values override any defaults.
            buttonConfig = {
                disabled : !!button.get('disabled'),
                isDefault: this._getButtonDefault(button),
                name     : this._getButtonName(button)
            };

            // Label should only be considered when not an empty string.
            label && (buttonConfig.label = label);

            // Merge `config` with `buttonConfig` values.
            Y.mix(config, buttonConfig, false, null, 0, true);
        }

        name      = this._getButtonName(config);
        defConfig = this.BUTTONS && this.BUTTONS[name];

        // Merge `config` with predefined default values.
        if (defConfig) {
            Y.mix(config, defConfig, false, null, 0, true);
        }

        return config;
    },

    /**
    `HTML_PARSER` implementation for the `buttons` attribute.

    **Note:** To determine a button node's name its `data-name` and `name`
    attributes are examined. Whether the button should be the default is
    determined by its `data-default` attribute.

    @method _parseButtons
    @param {Node} srcNode This widget's srcNode to search for buttons.
    @return {null|Object} `buttons` Config object parsed from this widget's DOM.
    @protected
    @since 3.5.0
    **/
    _parseButtons: function (srcNode) {
        var buttonSelector = '.' + WidgetButtons.CLASS_NAMES.button,
            sections       = ['header', 'body', 'footer'],
            buttonsConfig  = null;

        YArray.each(sections, function (section) {
            var container = this._getButtonContainer(section),
                buttons   = container && container.all(buttonSelector),
                sectionButtons;

            if (!buttons || buttons.isEmpty()) { return; }

            sectionButtons = [];

            // Creates a button config object for every button node found and
            // adds it to the section. This way each button configuration can be
            // merged with any defaults provided by predefined `BUTTONS`.
            buttons.each(function (button) {
                sectionButtons.push({srcNode: button});
            });

            buttonsConfig || (buttonsConfig = {});
            buttonsConfig[section] = sectionButtons;
        }, this);

        return buttonsConfig;
    },

    /**
    Setter for the `buttons` attribute. This processes the specified `config`
    and returns a new `buttons` object which is stored as the new state; leaving
    the original, specified `config` unmodified.

    The button nodes will either be created via `Y.Plugin.Button.createNode()`,
    or when a button is already a Node already, it will by `plug()`ed with
    `Y.Plugin.Button`.

    @method _setButtons
    @param {Array|Object} config The `buttons` configuration to process.
    @return {Object} The processed `buttons` object which represents the new
        state.
    @protected
    @since 3.5.0
    **/
    _setButtons: function (config) {
        var defSection = this.DEFAULT_BUTTONS_SECTION,
            buttons    = {};

        function processButtons(buttonConfigs, currentSection) {
            if (!isArray(buttonConfigs)) { return; }

            var i, len, button, section;

            for (i = 0, len = buttonConfigs.length; i < len; i += 1) {
                button  = buttonConfigs[i];
                section = currentSection;

                if (!isNode(button)) {
                    button = this._mergeButtonConfig(button);
                    section || (section = button.section);
                }

                // Always passes through `_createButton()` to make sure the node
                // is decorated as a button.
                button = this._createButton(button);

                // Use provided `section` or fallback to the default section.
                section || (section = defSection);

                // Add button to the array of buttons for the specified section.
                (buttons[section] || (buttons[section] = [])).push(button);
            }
        }

        // Handle `config` being either an Array or Object of Arrays.
        if (isArray(config)) {
            processButtons.call(this, config);
        } else {
            YObject.each(config, processButtons, this);
        }

        return buttons;
    },

    /**
    Syncs this widget's current button-related state to its DOM. This method is
    inserted via AOP, and will execute after `syncUI()`.

    @method _syncUIButtons
    @protected
    @since 3.4.0
    **/
    _syncUIButtons: function () {
        this._uiSetButtons(this.get('buttons'));
        this._uiSetDefaultButton(this.get('defaultButton'));
        this._uiSetVisibleButtons(this.get('visible'));
    },

    /**
    Inserts the specified `button` node into this widget's DOM at the specified
    `section` and `index` and updates the section content.

    The section and button container nodes will be created if they do not
    already exist.

    @method _uiInsertButton
    @param {Node} button The button node to insert into this widget's DOM.
    @param {String} section The `WidgetStdMod` section (header/body/footer).
    @param {Number} index Index at which the `button` should be positioned.
    @protected
    @since 3.5.0
    **/
    _uiInsertButton: function (button, section, index) {
        var buttonsClassName = WidgetButtons.CLASS_NAMES.button,
            buttonContainer  = this._getButtonContainer(section, true),
            sectionButtons   = buttonContainer.all('.' + buttonsClassName);

        // Inserts the button node at the correct index.
        buttonContainer.insertBefore(button, sectionButtons.item(index));

        // Adds the button container to the section content.
        this.setStdModContent(section, buttonContainer, 'after');
    },

    /**
    Removes the button node from this widget's DOM and detaches any event
    subscriptions on the button that were created by this widget. The section
    content will be updated unless `{preserveContent: true}` is passed in the
    `options`.

    By default the button container node will be removed when this removes the
    last button of the specified `section`; and if no other content remains in
    the section node, it will also be removed.

    @method _uiRemoveButton
    @param {Node} button The button to remove and destroy.
    @param {String} section The `WidgetStdMod` section (header/body/footer).
    @param {Object} [options] Additional options.
      @param {Boolean} [options.preserveContent=false] Whether the section
        content should be updated.
    @protected
    @since 3.5.0
    **/
    _uiRemoveButton: function (button, section, options) {
        var yuid    = Y.stamp(button, this),
            handles = this._buttonsHandles,
            handle  = handles[yuid],
            buttonContainer, buttonClassName;

        if (handle) {
            handle.detach();
        }

        delete handles[yuid];

        button.remove();

        options || (options = {});

        // Remove the button container and section nodes if needed.
        if (!options.preserveContent) {
            buttonContainer = this._getButtonContainer(section);
            buttonClassName = WidgetButtons.CLASS_NAMES.button;

            // Only matters if we have a button container which is empty.
            if (buttonContainer &&
                    buttonContainer.all('.' + buttonClassName).isEmpty()) {

                buttonContainer.remove();
                this._updateContentButtons(section);
            }
        }
    },

    /**
    Sets the current `buttons` state to this widget's DOM by rendering the
    specified collection of `buttons` and updates the contents of each section
    as needed.

    Button nodes which already exist in the DOM will remain intact, or will be
    moved if they should be in a new position. Old button nodes which are no
    longer represented in the specified `buttons` collection will be removed,
    and any event subscriptions on the button which were created by this widget
    will be detached.

    If the button nodes in this widget's DOM actually change, then each content
    section will be updated (or removed) appropriately.

    @method _uiSetButtons
    @param {Object} buttons The current `buttons` state to visually represent.
    @protected
    @since 3.5.0
    **/
    _uiSetButtons: function (buttons) {
        var buttonClassName = WidgetButtons.CLASS_NAMES.button,
            sections        = ['header', 'body', 'footer'];

        YArray.each(sections, function (section) {
            var sectionButtons  = buttons[section] || [],
                numButtons      = sectionButtons.length,
                buttonContainer = this._getButtonContainer(section, numButtons),
                buttonsUpdated  = false,
                oldNodes, i, button, buttonIndex;

            // When there's no button container, there are no new buttons or old
            // buttons that we have to deal with for this section.
            if (!buttonContainer) { return; }

            oldNodes = buttonContainer.all('.' + buttonClassName);

            for (i = 0; i < numButtons; i += 1) {
                button      = sectionButtons[i];
                buttonIndex = oldNodes.indexOf(button);

                // Buttons already rendered in the Widget should remain there or
                // moved to their new index. New buttons will be added to the
                // current `buttonContainer`.
                if (buttonIndex > -1) {
                    // Remove button from existing buttons nodeList since its in
                    // the DOM already.
                    oldNodes.splice(buttonIndex, 1);

                    // Check that the button is at the right position, if not,
                    // move it to its new position.
                    if (buttonIndex !== i) {
                        // Using `i + 1` because the button should be at index
                        // `i`; it's inserted before the node which comes after.
                        buttonContainer.insertBefore(button, i + 1);
                        buttonsUpdated = true;
                    }
                } else {
                    buttonContainer.appendChild(button);
                    buttonsUpdated = true;
                }
            }

            // Safely removes the old button nodes which are no longer part of
            // this widget's `buttons`.
            oldNodes.each(function (button) {
                this._uiRemoveButton(button, section, {preserveContent: true});
                buttonsUpdated = true;
            }, this);

            // Remove leftover empty button containers and updated the StdMod
            // content area.
            if (numButtons === 0) {
                buttonContainer.remove();
                this._updateContentButtons(section);
                return;
            }

            // Adds the button container to the section content.
            if (buttonsUpdated) {
                this.setStdModContent(section, buttonContainer, 'after');
            }
        }, this);
    },

    /**
    Adds the "yui3-button-primary" CSS class to the new `defaultButton` and
    removes it from the old default button.

    @method _uiSetDefaultButton
    @param {Node} newButton The new `defaultButton`.
    @param {Node} oldButton The old `defaultButton`.
    @protected
    @since 3.5.0
    **/
    _uiSetDefaultButton: function (newButton, oldButton) {
        var primaryClassName = WidgetButtons.CLASS_NAMES.primary;

        if (newButton) { newButton.addClass(primaryClassName); }
        if (oldButton) { oldButton.removeClass(primaryClassName); }
    },

    /**
    Focuses this widget's `defaultButton` if there is one and this widget is
    visible.

    @method _uiSetVisibleButtons
    @param {Boolean} visible Whether this widget is visible.
    @protected
    @since 3.5.0
    **/
    _uiSetVisibleButtons: function (visible) {
        if (!visible) { return; }

        var defaultButton = this.get('defaultButton');
        if (defaultButton) {
            defaultButton.focus();
        }
    },

    /**
    Removes the specified `button` from the buttons map (both name -> button and
    section:name -> button), and nulls-out the `defaultButton` if it is
    currently the default button.

    @method _unMapButton
    @param {Node} button The button node to remove from the buttons map.
    @param {String} section The `WidgetStdMod` section (header/body/footer).
    @protected
    @since 3.5.0
    **/
    _unMapButton: function (button, section) {
        var map  = this._buttonsMap,
            name = this._getButtonName(button),
            sectionName;

        // Only delete the map entry if the specified `button` is mapped to it.
        if (name) {
            // name -> button
            if (map[name] === button) {
                delete map[name];
            }

            // section:name -> button
            sectionName = section + ':' + name;
            if (map[sectionName] === button) {
                delete map[sectionName];
            }
        }

        // Clear the default button if its the specified `button`.
        if (this._defaultButton === button) {
            this._defaultButton = null;
        }
    },

    /**
    Updates the `defaultButton` attribute if it needs to be updated by comparing
    its current value with the protected `_defaultButton` property.

    @method _updateDefaultButton
    @protected
    @since 3.5.0
    **/
    _updateDefaultButton: function () {
        var defaultButton = this._defaultButton;

        if (this.get('defaultButton') !== defaultButton) {
            this._set('defaultButton', defaultButton);
        }
    },

    /**
    Updates the content attribute which corresponds to the specified `section`.

    The method updates the section's content to its current `childNodes`
    (text and/or HTMLElement), or will null-out its contents if the section is
    empty. It also specifies a `src` of `buttons` on the change event facade.

    @method _updateContentButtons
    @param {String} section The `WidgetStdMod` section (header/body/footer) to
        update.
    @protected
    @since 3.5.0
    **/
    _updateContentButtons: function (section) {
        // `childNodes` return text nodes and HTMLElements.
        var sectionContent = this.getStdModNode(section).get('childNodes');

        // Updates the section to its current contents, or null if it is empty.
        this.set(section + 'Content', sectionContent.isEmpty() ? null :
            sectionContent, {src: 'buttons'});
    },

    // -- Protected Event Handlers ---------------------------------------------

    /**
    Handles this widget's `buttonsChange` event which fires anytime the
    `buttons` attribute is modified.

    **Note:** This method special-cases the `buttons` modifications caused by
    `addButton()` and `removeButton()`, both of which set the `src` property on
    the event facade to "add" and "remove" respectively.

    @method _afterButtonsChange
    @param {EventFacade} e
    @protected
    @since 3.4.0
    **/
    _afterButtonsChange: function (e) {
        var buttons = e.newVal,
            section = e.section,
            index   = e.index,
            src     = e.src,
            button;

        // Special cases `addButton()` to only set and insert the new button.
        if (src === 'add') {
            // Make sure we have the button node.
            button = buttons[section][index];

            this._mapButton(button, section);
            this._updateDefaultButton();
            this._uiInsertButton(button, section, index);

            return;
        }

        // Special cases `removeButton()` to only remove the specified button.
        if (src === 'remove') {
            // Button node already exists on the event facade.
            button = e.button;

            this._unMapButton(button, section);
            this._updateDefaultButton();
            this._uiRemoveButton(button, section);

            return;
        }

        this._mapButtons(buttons);
        this._updateDefaultButton();
        this._uiSetButtons(buttons);
    },

    /**
    Handles this widget's `headerContentChange`, `bodyContentChange`,
    `footerContentChange` events by making sure the `buttons` remain rendered
    after changes to the content areas.

    These events are very chatty, so extra caution is taken to avoid doing extra
    work or getting into an infinite loop.

    @method _afterContentChangeButtons
    @param {EventFacade} e
    @protected
    @since 3.5.0
    **/
    _afterContentChangeButtons: function (e) {
        var src     = e.src,
            pos     = e.stdModPosition,
            replace = !pos || pos === WidgetStdMod.REPLACE;

        // Only do work when absolutely necessary.
        if (replace && src !== 'buttons' && src !== Widget.UI_SRC) {
            this._uiSetButtons(this.get('buttons'));
        }
    },

    /**
    Handles this widget's `defaultButtonChange` event by adding the
    "yui3-button-primary" CSS class to the new `defaultButton` and removing it
    from the old default button.

    @method _afterDefaultButtonChange
    @param {EventFacade} e
    @protected
    @since 3.5.0
    **/
    _afterDefaultButtonChange: function (e) {
        this._uiSetDefaultButton(e.newVal, e.prevVal);
    },

    /**
    Handles this widget's `visibleChange` event by focusing the `defaultButton`
    if there is one.

    @method _afterVisibleChangeButtons
    @param {EventFacade} e
    @protected
    @since 3.5.0
    **/
    _afterVisibleChangeButtons: function (e) {
        this._uiSetVisibleButtons(e.newVal);
    }
};

Y.WidgetButtons = WidgetButtons;


}, '3.17.1', {"requires": ["button-plugin", "cssbutton", "widget-stdmod"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-modality', function (Y, NAME) {

/**
 * Provides modality support for Widgets, though an extension
 *
 * @module widget-modality
 */

var WIDGET       = 'widget',
    RENDER_UI    = 'renderUI',
    BIND_UI      = 'bindUI',
    SYNC_UI      = 'syncUI',
    BOUNDING_BOX = 'boundingBox',
    VISIBLE      = 'visible',
    Z_INDEX      = 'zIndex',
    CHANGE       = 'Change',
    isBoolean    = Y.Lang.isBoolean,
    getCN        = Y.ClassNameManager.getClassName,
    MaskShow     = "maskShow",
    MaskHide     = "maskHide",
    ClickOutside = "clickoutside",
    FocusOutside = "focusoutside",

    supportsPosFixed = (function(){

        /*! IS_POSITION_FIXED_SUPPORTED - Juriy Zaytsev (kangax) - http://yura.thinkweb2.com/cft/ */

        var doc         = Y.config.doc,
            isSupported = null,
            el, root;

        if (doc.createElement) {
            el = doc.createElement('div');
            if (el && el.style) {
                el.style.position = 'fixed';
                el.style.top = '10px';
                root = doc.body;
                if (root && root.appendChild && root.removeChild) {
                    root.appendChild(el);
                    isSupported = (el.offsetTop === 10);
                    root.removeChild(el);
                }
            }
        }

        return isSupported;
    }());

    /**
     * Widget extension, which can be used to add modality support to the base Widget class,
     * through the Base.create method.
     *
     * @class WidgetModality
     * @param {Object} config User configuration object
     */
    function WidgetModal(config) {}

    var MODAL           = 'modal',
        MASK            = 'mask',
        MODAL_CLASSES   = {
            modal   : getCN(WIDGET, MODAL),
            mask    : getCN(WIDGET, MASK)
        };

    /**
    * Static property used to define the default attribute
    * configuration introduced by WidgetModality.
    *
    * @property ATTRS
    * @static
    * @type Object
    */
    WidgetModal.ATTRS = {
            /**
             * @attribute maskNode
             * @type Y.Node
             *
             * @description Returns a Y.Node instance of the node being used as the mask.
             */
            maskNode : {
                getter      : '_getMaskNode',
                readOnly    : true
            },


            /**
             * @attribute modal
             * @type boolean
             *
             * @description Whether the widget should be modal or not.
             */
            modal: {
                value:false,
                validator: isBoolean
            },

            /**
             * @attribute focusOn
             * @type array
             *
             * @description An array of objects corresponding to the nodes and events that will trigger a re-focus back on the widget.
             * The implementer can supply an array of objects, with each object having the following properties:
             * <p>eventName: (string, required): The eventName to listen to.</p>
             * <p>node: (Y.Node, optional): The Y.Node that will fire the event (defaults to the boundingBox of the widget)</p>
             * <p>By default, this attribute consists of two objects which will cause the widget to re-focus if anything
             * outside the widget is clicked on or focussed upon.</p>
             */
            focusOn: {
                valueFn: function() {
                    return [
                        {
                            // node: this.get(BOUNDING_BOX),
                            eventName: ClickOutside
                        },
                        {
                            //node: this.get(BOUNDING_BOX),
                            eventName: FocusOutside
                        }
                    ];
                },

                validator: Y.Lang.isArray
            }

    };


    WidgetModal.CLASSES = MODAL_CLASSES;


    WidgetModal._MASK = null;
    /**
     * Returns the mask if it exists on the page - otherwise creates a mask. There's only
     * one mask on a page at a given time.
     * <p>
     * This method in invoked internally by the getter of the maskNode ATTR.
     * </p>
     * @method _GET_MASK
     * @static
     */
    WidgetModal._GET_MASK = function() {

        var mask = WidgetModal._MASK,
            win  = Y.one('win');

        if (mask && (mask.getDOMNode() !== null) && mask.inDoc()) {
            return mask;
        }

        mask = Y.Node.create('<div></div>').addClass(MODAL_CLASSES.mask);
        WidgetModal._MASK = mask;

        if (supportsPosFixed) {
            mask.setStyles({
                position: 'fixed',
                width   : '100%',
                height  : '100%',
                top     : '0',
                left    : '0',
                display : 'block'
            });
        } else {
            mask.setStyles({
                position: 'absolute',
                width   : win.get('winWidth') +'px',
                height  : win.get('winHeight') + 'px',
                top     : '0',
                left    : '0',
                display : 'block'
            });
        }

        return mask;
    };

    /**
     * A stack of Y.Widget objects representing the current hierarchy of modal widgets presently displayed on the screen
     * @property STACK
     */
    WidgetModal.STACK = [];


    WidgetModal.prototype = {

        initializer: function () {
            Y.after(this._renderUIModal, this, RENDER_UI);
            Y.after(this._syncUIModal, this, SYNC_UI);
            Y.after(this._bindUIModal, this, BIND_UI);
        },

        destructor: function () {
            // Hack to remove this thing from the STACK.
            this._uiSetHostVisibleModal(false);
        },

        // *** Instance Members *** //

        _uiHandlesModal: null,


        /**
         * Adds modal class to the bounding box of the widget
         * <p>
         * This method in invoked after renderUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _renderUIModal
         * @protected
         */
        _renderUIModal : function () {

            var bb = this.get(BOUNDING_BOX);
                //cb = this.get(CONTENT_BOX);

            //this makes the content box content appear over the mask
            // cb.setStyles({
            //     position: ""
            // });

            this._repositionMask(this);
            bb.addClass(MODAL_CLASSES.modal);

        },


        /**
         * Hooks up methods to be executed when the widget's visibility or z-index changes
         * <p>
         * This method in invoked after bindUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _bindUIModal
         * @protected
         */
        _bindUIModal : function () {

            this.after(VISIBLE+CHANGE, this._afterHostVisibleChangeModal);
            this.after(Z_INDEX+CHANGE, this._afterHostZIndexChangeModal);
            this.after("focusOnChange", this._afterFocusOnChange);

            // Re-align the mask in the viewport if `position: fixed;` is not
            // supported. iOS < 5 and Android < 3 don't actually support it even
            // though they both pass the feature test; the UA sniff is here to
            // account for that. Ideally this should be replaced with a better
            // feature test.
            if (!supportsPosFixed ||
                    (Y.UA.ios && Y.UA.ios < 5) ||
                    (Y.UA.android && Y.UA.android < 3)) {

                Y.one('win').on('scroll', this._resyncMask, this);
            }
        },

        /**
         * Syncs the mask with the widget's current state, namely the visibility and z-index of the widget
         * <p>
         * This method in invoked after syncUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _syncUIModal
         * @protected
         */
        _syncUIModal : function () {

            //var host = this.get(HOST);

            this._uiSetHostVisibleModal(this.get(VISIBLE));

        },

        /**
         * Provides mouse and tab focus to the widget's bounding box.
         *
         * @method _focus
         */
        _focus : function () {

            var bb = this.get(BOUNDING_BOX),
            oldTI = bb.get('tabIndex');

            bb.set('tabIndex', oldTI >= 0 ? oldTI : 0);
            this.focus();
        },
        /**
         * Blurs the widget.
         *
         * @method _blur
         */
        _blur : function () {

            this.blur();
        },

        /**
         * Returns the Y.Node instance of the maskNode
         *
         * @method _getMaskNode
         * @return {Node} The Y.Node instance of the mask, as returned from WidgetModal._GET_MASK
         */
        _getMaskNode : function () {

            return WidgetModal._GET_MASK();
        },

        /**
         * Performs events attaching/detaching, stack shifting and mask repositioning based on the visibility of the widget
         *
         * @method _uiSetHostVisibleModal
         * @param {boolean} Whether the widget is visible or not
         */
        _uiSetHostVisibleModal : function (visible) {
            var stack    = WidgetModal.STACK,
                maskNode = this.get('maskNode'),
                isModal  = this.get('modal'),
                topModal, index;

            if (visible) {

                Y.Array.each(stack, function(modal){
                    modal._detachUIHandlesModal();
                    modal._blur();
                });

                // push on top of stack
                stack.unshift(this);

                this._repositionMask(this);
                this._uiSetHostZIndexModal(this.get(Z_INDEX));

                if (isModal) {
                    maskNode.show();
                    Y.later(1, this, '_attachUIHandlesModal');
                    this._focus();
                }


            } else {

                index = Y.Array.indexOf(stack, this);
                if (index >= 0) {
                    // Remove modal widget from global stack.
                    stack.splice(index, 1);
                }

                this._detachUIHandlesModal();
                this._blur();

                if (stack.length) {
                    topModal = stack[0];
                    this._repositionMask(topModal);
                    //topModal._attachUIHandlesModal();
                    topModal._uiSetHostZIndexModal(topModal.get(Z_INDEX));

                    if (topModal.get('modal')) {
                        //topModal._attachUIHandlesModal();
                        Y.later(1, topModal, '_attachUIHandlesModal');
                        topModal._focus();
                    }

                } else {

                    if (maskNode.getStyle('display') === 'block') {
                        maskNode.hide();
                    }

                }

            }
        },

        /**
         * Sets the z-index of the mask node.
         *
         * @method _uiSetHostZIndexModal
         * @param {Number} Z-Index of the widget
         */
        _uiSetHostZIndexModal : function (zIndex) {

            if (this.get('modal')) {
                this.get('maskNode').setStyle(Z_INDEX, zIndex || 0);
            }

        },

        /**
         * Attaches UI Listeners for "clickoutside" and "focusoutside" on the
         * widget. When these events occur, and the widget is modal, focus is
         * shifted back onto the widget.
         *
         * @method _attachUIHandlesModal
         */
        _attachUIHandlesModal : function () {

            if (this._uiHandlesModal || WidgetModal.STACK[0] !== this) {
                // Quit early if we have ui handles, or if we not at the top
                // of the global stack.
                return;
            }

            var bb          = this.get(BOUNDING_BOX),
                maskNode    = this.get('maskNode'),
                focusOn     = this.get('focusOn'),
                focus       = Y.bind(this._focus, this),
                uiHandles   = [],
                i, len, o;

            for (i = 0, len = focusOn.length; i < len; i++) {

                o = {};
                o.node = focusOn[i].node;
                o.ev = focusOn[i].eventName;
                o.keyCode = focusOn[i].keyCode;

                //no keycode or node defined
                if (!o.node && !o.keyCode && o.ev) {
                    uiHandles.push(bb.on(o.ev, focus));
                }

                //node defined, no keycode (not a keypress)
                else if (o.node && !o.keyCode && o.ev) {
                    uiHandles.push(o.node.on(o.ev, focus));
                }

                //node defined, keycode defined, event defined (its a key press)
                else if (o.node && o.keyCode && o.ev) {
                    uiHandles.push(o.node.on(o.ev, focus, o.keyCode));
                }

                else {
                    Y.Log('focusOn ATTR Error: The event with name "'+o.ev+'" could not be attached.');
                }

            }

            if ( ! supportsPosFixed) {
                uiHandles.push(Y.one('win').on('scroll', Y.bind(function(){
                    maskNode.setStyle('top', maskNode.get('docScrollY'));
                }, this)));
            }

            this._uiHandlesModal = uiHandles;
        },

        /**
         * Detaches all UI Listeners that were set in _attachUIHandlesModal from the widget.
         *
         * @method _detachUIHandlesModal
         */
        _detachUIHandlesModal : function () {
            Y.each(this._uiHandlesModal, function(h){
                h.detach();
            });
            this._uiHandlesModal = null;
        },

        /**
         * Default function that is called when visibility is changed on the widget.
         *
         * @method _afterHostVisibleChangeModal
         * @param {EventFacade} e The event facade of the change
         */
        _afterHostVisibleChangeModal : function (e) {

            this._uiSetHostVisibleModal(e.newVal);
        },

        /**
         * Default function that is called when z-index is changed on the widget.
         *
         * @method _afterHostZIndexChangeModal
         * @param {EventFacade} e The event facade of the change
         */
        _afterHostZIndexChangeModal : function (e) {

            this._uiSetHostZIndexModal(e.newVal);
        },

        /**
         * Returns a boolean representing whether the current widget is in a "nested modality" state.
         * This is done by checking the number of widgets currently on the stack.
         *
         * @method isNested
         * @public
         */
        isNested: function() {
            var length = WidgetModal.STACK.length,
            retval = (length > 1) ? true : false;
            return retval;
        },

        /**
         * Repositions the mask in the DOM for nested modality cases.
         *
         * @method _repositionMask
         * @param {Widget} nextElem The Y.Widget instance that will be visible in the stack once the current widget is closed.
         */
        _repositionMask: function(nextElem) {

            var currentModal = this.get('modal'),
                nextModal    = nextElem.get('modal'),
                maskNode     = this.get('maskNode'),
                bb, bbParent;

            //if this is modal and host is not modal
            if (currentModal && !nextModal) {
                //leave the mask where it is, since the host is not modal.
                maskNode.remove();
                this.fire(MaskHide);
            }

            //if the main widget is not modal but the host is modal, or both of them are modal
            else if ((!currentModal && nextModal) || (currentModal && nextModal)) {

                //then remove the mask off DOM, reposition it, and reinsert it into the DOM
                maskNode.remove();
                this.fire(MaskHide);
                bb = nextElem.get(BOUNDING_BOX);
                bbParent = bb.get('parentNode') || Y.one('body');
                bbParent.insert(maskNode, bbParent.get('firstChild'));
                this.fire(MaskShow);
            }

        },

        /**
         * Resyncs the mask in the viewport for browsers that don't support fixed positioning
         *
         * @method _resyncMask
         * @param {Y.Widget} nextElem The Y.Widget instance that will be visible in the stack once the current widget is closed.
         * @private
         */
        _resyncMask: function (e) {
            var o       = e.currentTarget,
                offsetX = o.get('docScrollX'),
                offsetY = o.get('docScrollY'),
                w       = o.get('innerWidth') || o.get('winWidth'),
                h       = o.get('innerHeight') || o.get('winHeight'),
                mask    = this.get('maskNode');

            mask.setStyles({
                "top": offsetY + "px",
                "left": offsetX + "px",
                "width": w + 'px',
                "height": h + 'px'
            });
        },

        /**
         * Default function called when focusOn Attribute is changed. Remove existing listeners and create new listeners.
         *
         * @method _afterFocusOnChange
         */
        _afterFocusOnChange : function() {
            this._detachUIHandlesModal();

            if (this.get(VISIBLE)) {
                this._attachUIHandlesModal();
            }
        }
    };

    Y.WidgetModality = WidgetModal;



}, '3.17.1', {"requires": ["base-build", "event-outside", "widget"], "skinnable": true});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-position-align', function (Y, NAME) {

/**
Provides extended/advanced XY positioning support for Widgets, through an
extension.

It builds on top of the `widget-position` module, to provide alignment and
centering support. Future releases aim to add constrained and fixed positioning
support.

@module widget-position-align
**/
var Lang = Y.Lang,

    ALIGN        = 'align',
    ALIGN_ON     = 'alignOn',

    VISIBLE      = 'visible',
    BOUNDING_BOX = 'boundingBox',

    OFFSET_WIDTH    = 'offsetWidth',
    OFFSET_HEIGHT   = 'offsetHeight',
    REGION          = 'region',
    VIEWPORT_REGION = 'viewportRegion';

/**
Widget extension, which can be used to add extended XY positioning support to
the base Widget class, through the `Base.create` method.

**Note:** This extension requires that the `WidgetPosition` extension be added
to the Widget (before `WidgetPositionAlign`, if part of the same extension list
passed to `Base.build`).

@class WidgetPositionAlign
@param {Object} config User configuration object.
@constructor
**/
function PositionAlign (config) {}

PositionAlign.ATTRS = {

    /**
    The alignment configuration for this widget.

    The `align` attribute is used to align a reference point on the widget, with
    the reference point on another `Node`, or the viewport. The object which
    `align` expects has the following properties:

      * __`node`__: The `Node` to which the widget is to be aligned. If set to
        `null`, or not provided, the widget is aligned to the viewport.

      * __`points`__: A two element Array, defining the two points on the widget
        and `Node`/viewport which are to be aligned. The first element is the
        point on the widget, and the second element is the point on the
        `Node`/viewport. Supported alignment points are defined as static
        properties on `WidgetPositionAlign`.

    @example Aligns the top-right corner of the widget with the top-left corner
    of the viewport:

        myWidget.set('align', {
            points: [Y.WidgetPositionAlign.TR, Y.WidgetPositionAlign.TL]
        });

    @attribute align
    @type Object
    @default null
    **/
    align: {
        value: null
    },

    /**
    A convenience Attribute, which can be used as a shortcut for the `align`
    Attribute.

    If set to `true`, the widget is centered in the viewport. If set to a `Node`
    reference or valid selector String, the widget will be centered within the
    `Node`. If set to `false`, no center positioning is applied.

    @attribute centered
    @type Boolean|Node
    @default false
    **/
    centered: {
        setter : '_setAlignCenter',
        lazyAdd:false,
        value  :false
    },

    /**
    An Array of Objects corresponding to the `Node`s and events that will cause
    the alignment of this widget to be synced to the DOM.

    The `alignOn` Attribute is expected to be an Array of Objects with the
    following properties:

      * __`eventName`__: The String event name to listen for.

      * __`node`__: The optional `Node` that will fire the event, it can be a
        `Node` reference or a selector String. This will default to the widget's
        `boundingBox`.

    @example Sync this widget's alignment on window resize:

        myWidget.set('alignOn', [
            {
                node     : Y.one('win'),
                eventName: 'resize'
            }
        ]);

    @attribute alignOn
    @type Array
    @default []
    **/
    alignOn: {
        value    : [],
        validator: Y.Lang.isArray
    }
};

/**
Constant used to specify the top-left corner for alignment

@property TL
@type String
@value 'tl'
@static
**/
PositionAlign.TL = 'tl';

/**
Constant used to specify the top-right corner for alignment

@property TR
@type String
@value 'tr'
@static
**/
PositionAlign.TR = 'tr';

/**
Constant used to specify the bottom-left corner for alignment

@property BL
@type String
@value 'bl'
@static
**/
PositionAlign.BL = 'bl';

/**
Constant used to specify the bottom-right corner for alignment

@property BR
@type String
@value 'br'
@static
**/
PositionAlign.BR = 'br';

/**
Constant used to specify the top edge-center point for alignment

@property TC
@type String
@value 'tc'
@static
**/
PositionAlign.TC = 'tc';

/**
Constant used to specify the right edge, center point for alignment

@property RC
@type String
@value 'rc'
@static
**/
PositionAlign.RC = 'rc';

/**
Constant used to specify the bottom edge, center point for alignment

@property BC
@type String
@value 'bc'
@static
**/
PositionAlign.BC = 'bc';

/**
Constant used to specify the left edge, center point for alignment

@property LC
@type String
@value 'lc'
@static
**/
PositionAlign.LC = 'lc';

/**
Constant used to specify the center of widget/node/viewport for alignment

@property CC
@type String
@value 'cc'
@static
*/
PositionAlign.CC = 'cc';

PositionAlign.prototype = {
    // -- Protected Properties -------------------------------------------------


    initializer : function() {
        if (!this._posNode) {
            Y.error('WidgetPosition needs to be added to the Widget, ' +
                'before WidgetPositionAlign is added');
        }

        Y.after(this._bindUIPosAlign, this, 'bindUI');
        Y.after(this._syncUIPosAlign, this, 'syncUI');
    },

    /**
    Holds the alignment-syncing event handles.

    @property _posAlignUIHandles
    @type Array
    @default null
    @protected
    **/
    _posAlignUIHandles: null,

    // -- Lifecycle Methods ----------------------------------------------------

    destructor: function () {
        this._detachPosAlignUIHandles();
    },

    /**
    Bind event listeners responsible for updating the UI state in response to
    the widget's position-align related state changes.

    This method is invoked after `bindUI` has been invoked for the `Widget`
    class using the AOP infrastructure.

    @method _bindUIPosAlign
    @protected
    **/
    _bindUIPosAlign: function () {
        this.after('alignChange', this._afterAlignChange);
        this.after('alignOnChange', this._afterAlignOnChange);
        this.after('visibleChange', this._syncUIPosAlign);
    },

    /**
    Synchronizes the current `align` Attribute value to the DOM.

    This method is invoked after `syncUI` has been invoked for the `Widget`
    class using the AOP infrastructure.

    @method _syncUIPosAlign
    @protected
    **/
    _syncUIPosAlign: function () {
        var align = this.get(ALIGN);

        this._uiSetVisiblePosAlign(this.get(VISIBLE));

        if (align) {
            this._uiSetAlign(align.node, align.points);
        }
    },

    // -- Public Methods -------------------------------------------------------

    /**
    Aligns this widget to the provided `Node` (or viewport) using the provided
    points. This method can be invoked with no arguments which will cause the
    widget's current `align` Attribute value to be synced to the DOM.

    @example Aligning to the top-left corner of the `<body>`:

        myWidget.align('body',
            [Y.WidgetPositionAlign.TL, Y.WidgetPositionAlign.TR]);

    @method align
    @param {Node|String|null} [node] A reference (or selector String) for the
      `Node` which with the widget is to be aligned. If null is passed in, the
      widget will be aligned with the viewport.
    @param {Array[2]} [points] A two item array specifying the points on the
      widget and `Node`/viewport which will to be aligned. The first entry is
      the point on the widget, and the second entry is the point on the
      `Node`/viewport. Valid point references are defined as static constants on
      the `WidgetPositionAlign` extension.
    @chainable
    **/
    align: function (node, points) {
        if (arguments.length) {
            // Set the `align` Attribute.
            this.set(ALIGN, {
                node  : node,
                points: points
            });
        } else {
            // Sync the current `align` Attribute value to the DOM.
            this._syncUIPosAlign();
        }

        return this;
    },

    /**
    Centers the widget in the viewport, or if a `Node` is passed in, it will
    be centered to that `Node`.

    @method centered
    @param {Node|String} [node] A `Node` reference or selector String defining
      the `Node` which the widget should be centered. If a `Node` is not  passed
      in, then the widget will be centered to the viewport.
    @chainable
    **/
    centered: function (node) {
        return this.align(node, [PositionAlign.CC, PositionAlign.CC]);
    },

    // -- Protected Methods ----------------------------------------------------

    /**
    Default setter for `center` Attribute changes. Sets up the appropriate
    value, and passes it through the to the align attribute.

    @method _setAlignCenter
    @param {Boolean|Node} val The Attribute value being set.
    @return {Boolean|Node} the value passed in.
    @protected
    **/
    _setAlignCenter: function (val) {
        if (val) {
            this.set(ALIGN, {
                node  : val === true ? null : val,
                points: [PositionAlign.CC, PositionAlign.CC]
            });
        }

        return val;
    },

    /**
    Updates the UI to reflect the `align` value passed in.

    **Note:** See the `align` Attribute documentation, for the Object structure
    expected.

    @method _uiSetAlign
    @param {Node|String|null} [node] The node to align to, or null to indicate
      the viewport.
    @param {Array} points The alignment points.
    @protected
    **/
    _uiSetAlign: function (node, points) {
        if ( ! Lang.isArray(points) || points.length !== 2) {
            Y.error('align: Invalid Points Arguments');
            return;
        }

        var nodeRegion = this._getRegion(node),
            widgetPoint, nodePoint, xy;

        if ( ! nodeRegion) {
            // No-op, nothing to align to.
            return;
        }

        widgetPoint = points[0];
        nodePoint   = points[1];

        // TODO: Optimize KWeight - Would lookup table help?
        switch (nodePoint) {
        case PositionAlign.TL:
            xy = [nodeRegion.left, nodeRegion.top];
            break;

        case PositionAlign.TR:
            xy = [nodeRegion.right, nodeRegion.top];
            break;

        case PositionAlign.BL:
            xy = [nodeRegion.left, nodeRegion.bottom];
            break;

        case PositionAlign.BR:
            xy = [nodeRegion.right, nodeRegion.bottom];
            break;

        case PositionAlign.TC:
            xy = [
                nodeRegion.left + Math.floor(nodeRegion.width / 2),
                nodeRegion.top
            ];
            break;

        case PositionAlign.BC:
            xy = [
                nodeRegion.left + Math.floor(nodeRegion.width / 2),
                nodeRegion.bottom
            ];
            break;

        case PositionAlign.LC:
            xy = [
                nodeRegion.left,
                nodeRegion.top + Math.floor(nodeRegion.height / 2)
            ];
            break;

        case PositionAlign.RC:
            xy = [
                nodeRegion.right,
                nodeRegion.top + Math.floor(nodeRegion.height / 2)
            ];
            break;

        case PositionAlign.CC:
            xy = [
                nodeRegion.left + Math.floor(nodeRegion.width / 2),
                nodeRegion.top + Math.floor(nodeRegion.height / 2)
            ];
            break;

        default:
            break;

        }

        if (xy) {
            this._doAlign(widgetPoint, xy[0], xy[1]);
        }
    },

    /**
    Attaches or detaches alignment-syncing event handlers based on the widget's
    `visible` Attribute state.

    @method _uiSetVisiblePosAlign
    @param {Boolean} visible The current value of the widget's `visible`
      Attribute.
    @protected
    **/
    _uiSetVisiblePosAlign: function (visible) {
        if (visible) {
            this._attachPosAlignUIHandles();
        } else {
            this._detachPosAlignUIHandles();
        }
    },

    /**
    Attaches the alignment-syncing event handlers.

    @method _attachPosAlignUIHandles
    @protected
    **/
    _attachPosAlignUIHandles: function () {
        if (this._posAlignUIHandles) {
            // No-op if we have already setup the event handlers.
            return;
        }

        var bb        = this.get(BOUNDING_BOX),
            syncAlign = Y.bind(this._syncUIPosAlign, this),
            handles   = [];

        Y.Array.each(this.get(ALIGN_ON), function (o) {
            var event = o.eventName,
                node  = Y.one(o.node) || bb;

            if (event) {
                handles.push(node.on(event, syncAlign));
            }
        });

        this._posAlignUIHandles = handles;
    },

    /**
    Detaches the alignment-syncing event handlers.

    @method _detachPosAlignUIHandles
    @protected
    **/
    _detachPosAlignUIHandles: function () {
        var handles = this._posAlignUIHandles;
        if (handles) {
            new Y.EventHandle(handles).detach();
            this._posAlignUIHandles = null;
        }
    },

    // -- Private Methods ------------------------------------------------------

    /**
    Helper method, used to align the given point on the widget, with the XY page
    coordinates provided.

    @method _doAlign
    @param {String} widgetPoint Supported point constant
      (e.g. WidgetPositionAlign.TL)
    @param {Number} x X page coordinate to align to.
    @param {Number} y Y page coordinate to align to.
    @private
    **/
    _doAlign: function (widgetPoint, x, y) {
        var widgetNode = this._posNode,
            xy;

        switch (widgetPoint) {
        case PositionAlign.TL:
            xy = [x, y];
            break;

        case PositionAlign.TR:
            xy = [
                x - widgetNode.get(OFFSET_WIDTH),
                y
            ];
            break;

        case PositionAlign.BL:
            xy = [
                x,
                y - widgetNode.get(OFFSET_HEIGHT)
            ];
            break;

        case PositionAlign.BR:
            xy = [
                x - widgetNode.get(OFFSET_WIDTH),
                y - widgetNode.get(OFFSET_HEIGHT)
            ];
            break;

        case PositionAlign.TC:
            xy = [
                x - (widgetNode.get(OFFSET_WIDTH) / 2),
                y
            ];
            break;

        case PositionAlign.BC:
            xy = [
                x - (widgetNode.get(OFFSET_WIDTH) / 2),
                y - widgetNode.get(OFFSET_HEIGHT)
            ];
            break;

        case PositionAlign.LC:
            xy = [
                x,
                y - (widgetNode.get(OFFSET_HEIGHT) / 2)
            ];
            break;

        case PositionAlign.RC:
            xy = [
                x - widgetNode.get(OFFSET_WIDTH),
                y - (widgetNode.get(OFFSET_HEIGHT) / 2)
            ];
            break;

        case PositionAlign.CC:
            xy = [
                x - (widgetNode.get(OFFSET_WIDTH) / 2),
                y - (widgetNode.get(OFFSET_HEIGHT) / 2)
            ];
            break;

        default:
            break;

        }

        if (xy) {
            this.move(xy);
        }
    },

    /**
    Returns the region of the passed-in `Node`, or the viewport region if
    calling with passing in a `Node`.

    @method _getRegion
    @param {Node} [node] The node to get the region of.
    @return {Object} The node's region.
    @private
    **/
    _getRegion: function (node) {
        var nodeRegion;

        if ( ! node) {
            nodeRegion = this._posNode.get(VIEWPORT_REGION);
        } else {
            node = Y.Node.one(node);
            if (node) {
                nodeRegion = node.get(REGION);
            }
        }

        return nodeRegion;
    },

    // -- Protected Event Handlers ---------------------------------------------

    /**
    Handles `alignChange` events by updating the UI in response to `align`
    Attribute changes.

    @method _afterAlignChange
    @param {EventFacade} e
    @protected
    **/
    _afterAlignChange: function (e) {
        var align = e.newVal;
        if (align) {
            this._uiSetAlign(align.node, align.points);
        }
    },

    /**
    Handles `alignOnChange` events by updating the alignment-syncing event
    handlers.

    @method _afterAlignOnChange
    @param {EventFacade} e
    @protected
    **/
    _afterAlignOnChange: function(e) {
        this._detachPosAlignUIHandles();

        if (this.get(VISIBLE)) {
            this._attachPosAlignUIHandles();
        }
    }
};

Y.WidgetPositionAlign = PositionAlign;


}, '3.17.1', {"requires": ["widget-position"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-position-constrain', function (Y, NAME) {

/**
 * Provides constrained xy positioning support for Widgets, through an extension.
 *
 * It builds on top of the widget-position module, to provide constrained positioning support.
 *
 * @module widget-position-constrain
 */
var CONSTRAIN = "constrain",
    CONSTRAIN_XYCHANGE = "constrain|xyChange",
    CONSTRAIN_CHANGE = "constrainChange",

    PREVENT_OVERLAP = "preventOverlap",
    ALIGN = "align",

    EMPTY_STR = "",

    BINDUI = "bindUI",

    XY = "xy",
    X_COORD = "x",
    Y_COORD = "y",

    Node = Y.Node,

    VIEWPORT_REGION = "viewportRegion",
    REGION = "region",

    PREVENT_OVERLAP_MAP;

/**
 * A widget extension, which can be used to add constrained xy positioning support to the base Widget class,
 * through the <a href="Base.html#method_build">Base.build</a> method. This extension requires that
 * the WidgetPosition extension be added to the Widget (before WidgetPositionConstrain, if part of the same
 * extension list passed to Base.build).
 *
 * @class WidgetPositionConstrain
 * @param {Object} User configuration object
 */
function PositionConstrain(config) {}

/**
 * Static property used to define the default attribute
 * configuration introduced by WidgetPositionConstrain.
 *
 * @property ATTRS
 * @type Object
 * @static
 */
PositionConstrain.ATTRS = {

    /**
     * @attribute constrain
     * @type boolean | Node
     * @default null
     * @description The node to constrain the widget's bounding box to, when setting xy. Can also be
     * set to true, to constrain to the viewport.
     */
    constrain : {
        value: null,
        setter: "_setConstrain"
    },

    /**
     * @attribute preventOverlap
     * @type boolean
     * @description If set to true, and WidgetPositionAlign is also added to the Widget,
     * constrained positioning will attempt to prevent the widget's bounding box from overlapping
     * the element to which it has been aligned, by flipping the orientation of the alignment
     * for corner based alignments
     */
    preventOverlap : {
        value:false
    }
};

/**
 * @property _PREVENT_OVERLAP
 * @static
 * @protected
 * @type Object
 * @description The set of positions for which to prevent
 * overlap.
 */
PREVENT_OVERLAP_MAP = PositionConstrain._PREVENT_OVERLAP = {
    x: {
        "tltr": 1,
        "blbr": 1,
        "brbl": 1,
        "trtl": 1
    },
    y : {
        "trbr": 1,
        "tlbl": 1,
        "bltl": 1,
        "brtr": 1
    }
};

PositionConstrain.prototype = {

    initializer : function() {
        if (!this._posNode) {
            Y.error("WidgetPosition needs to be added to the Widget, before WidgetPositionConstrain is added");
        }
        Y.after(this._bindUIPosConstrained, this, BINDUI);
    },

    /**
     * Calculates the constrained positions for the XY positions provided, using
     * the provided node argument is passed in. If no node value is passed in, the value of
     * the "constrain" attribute is used.
     *
     * @method getConstrainedXY
     * @param {Array} xy The xy values to constrain
     * @param {Node | boolean} node Optional. The node to constrain to, or true for the viewport
     * @return {Array} The constrained xy values
     */
    getConstrainedXY : function(xy, node) {
        node = node || this.get(CONSTRAIN);

        var constrainingRegion = this._getRegion((node === true) ? null : node),
            nodeRegion = this._posNode.get(REGION);

        return [
            this._constrain(xy[0], X_COORD, nodeRegion, constrainingRegion),
            this._constrain(xy[1], Y_COORD, nodeRegion, constrainingRegion)
        ];
    },

    /**
     * Constrains the widget's bounding box to a node (or the viewport). If xy or node are not
     * passed in, the current position and the value of "constrain" will be used respectively.
     *
     * The widget's position will be changed to the constrained position.
     *
     * @method constrain
     * @param {Array} xy Optional. The xy values to constrain
     * @param {Node | boolean} node Optional. The node to constrain to, or true for the viewport
     */
    constrain : function(xy, node) {
        var currentXY,
            constrainedXY,
            constraint = node || this.get(CONSTRAIN);

        if (constraint) {
            currentXY = xy || this.get(XY);
            constrainedXY = this.getConstrainedXY(currentXY, constraint);

            if (constrainedXY[0] !== currentXY[0] || constrainedXY[1] !== currentXY[1]) {
                this.set(XY, constrainedXY, { constrained:true });
            }
        }
    },

    /**
     * The setter implementation for the "constrain" attribute.
     *
     * @method _setConstrain
     * @protected
     * @param {Node | boolean} val The attribute value
     */
    _setConstrain : function(val) {
        return (val === true) ? val : Node.one(val);
    },

    /**
     * The method which performs the actual constrain calculations for a given axis ("x" or "y") based
     * on the regions provided.
     *
     * @method _constrain
     * @protected
     *
     * @param {Number} val The value to constrain
     * @param {String} axis The axis to use for constrainment
     * @param {Region} nodeRegion The region of the node to constrain
     * @param {Region} constrainingRegion The region of the node (or viewport) to constrain to
     *
     * @return {Number} The constrained value
     */
    _constrain: function(val, axis, nodeRegion, constrainingRegion) {
        if (constrainingRegion) {

            if (this.get(PREVENT_OVERLAP)) {
                val = this._preventOverlap(val, axis, nodeRegion, constrainingRegion);
            }

            var x = (axis == X_COORD),

                regionSize    = (x) ? constrainingRegion.width : constrainingRegion.height,
                nodeSize      = (x) ? nodeRegion.width : nodeRegion.height,
                minConstraint = (x) ? constrainingRegion.left : constrainingRegion.top,
                maxConstraint = (x) ? constrainingRegion.right - nodeSize : constrainingRegion.bottom - nodeSize;

            if (val < minConstraint || val > maxConstraint) {
                if (nodeSize < regionSize) {
                    if (val < minConstraint) {
                        val = minConstraint;
                    } else if (val > maxConstraint) {
                        val = maxConstraint;
                    }
                } else {
                    val = minConstraint;
                }
            }
        }

        return val;
    },

    /**
     * The method which performs the preventOverlap calculations for a given axis ("x" or "y") based
     * on the value and regions provided.
     *
     * @method _preventOverlap
     * @protected
     *
     * @param {Number} val The value being constrain
     * @param {String} axis The axis to being constrained
     * @param {Region} nodeRegion The region of the node being constrained
     * @param {Region} constrainingRegion The region of the node (or viewport) we need to constrain to
     *
     * @return {Number} The constrained value
     */
    _preventOverlap : function(val, axis, nodeRegion, constrainingRegion) {

        var align = this.get(ALIGN),
            x = (axis === X_COORD),
            nodeSize,
            alignRegion,
            nearEdge,
            farEdge,
            spaceOnNearSide,
            spaceOnFarSide;

        if (align && align.points && PREVENT_OVERLAP_MAP[axis][align.points.join(EMPTY_STR)]) {

            alignRegion = this._getRegion(align.node);

            if (alignRegion) {
                nodeSize        = (x) ? nodeRegion.width : nodeRegion.height;
                nearEdge        = (x) ? alignRegion.left : alignRegion.top;
                farEdge         = (x) ? alignRegion.right : alignRegion.bottom;
                spaceOnNearSide = (x) ? alignRegion.left - constrainingRegion.left : alignRegion.top - constrainingRegion.top;
                spaceOnFarSide  = (x) ? constrainingRegion.right - alignRegion.right : constrainingRegion.bottom - alignRegion.bottom;
            }

            if (val > nearEdge) {
                if (spaceOnFarSide < nodeSize && spaceOnNearSide > nodeSize) {
                    val = nearEdge - nodeSize;
                }
            } else {
                if (spaceOnNearSide < nodeSize && spaceOnFarSide > nodeSize) {
                    val = farEdge;
                }
            }
        }

        return val;
    },

    /**
     * Binds event listeners responsible for updating the UI state in response to
     * Widget constrained positioning related state changes.
     * <p>
     * This method is invoked after bindUI is invoked for the Widget class
     * using YUI's aop infrastructure.
     * </p>
     *
     * @method _bindUIPosConstrained
     * @protected
     */
    _bindUIPosConstrained : function() {
        this.after(CONSTRAIN_CHANGE, this._afterConstrainChange);
        this._enableConstraints(this.get(CONSTRAIN));
    },

    /**
     * After change listener for the "constrain" attribute, responsible
     * for updating the UI, in response to attribute changes.
     *
     * @method _afterConstrainChange
     * @protected
     * @param {EventFacade} e The event facade
     */
    _afterConstrainChange : function(e) {
        this._enableConstraints(e.newVal);
    },

    /**
     * Updates the UI if enabling constraints, and sets up the xyChange event listeners
     * to constrain whenever the widget is moved. Disabling constraints removes the listeners.
     *
     * @method _enableConstraints
     * @private
     * @param {boolean} enable Enable or disable constraints
     */
    _enableConstraints : function(enable) {
        if (enable) {
            this.constrain();
            this._cxyHandle = this._cxyHandle || this.on(CONSTRAIN_XYCHANGE, this._constrainOnXYChange);
        } else if (this._cxyHandle) {
            this._cxyHandle.detach();
            this._cxyHandle = null;
        }
    },

    /**
     * The on change listener for the "xy" attribute. Modifies the event facade's
     * newVal property with the constrained XY value.
     *
     * @method _constrainOnXYChange
     * @protected
     * @param {EventFacade} e The event facade for the attribute change
     */
    _constrainOnXYChange : function(e) {
        if (!e.constrained) {
            e.newVal = this.getConstrainedXY(e.newVal);
        }
    },

    /**
     * Utility method to normalize region retrieval from a node instance,
     * or the viewport, if no node is provided.
     *
     * @method _getRegion
     * @private
     * @param {Node} node Optional.
     */
    _getRegion : function(node) {
        var region;
        if (!node) {
            region = this._posNode.get(VIEWPORT_REGION);
        } else {
            node = Node.one(node);
            if (node) {
                region = node.get(REGION);
            }
        }
        return region;
    }
};

Y.WidgetPositionConstrain = PositionConstrain;


}, '3.17.1', {"requires": ["widget-position"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-stack', function (Y, NAME) {

/**
 * Provides stackable (z-index) support for Widgets through an extension.
 *
 * @module widget-stack
 */
    var L = Y.Lang,
        UA = Y.UA,
        Node = Y.Node,
        Widget = Y.Widget,

        ZINDEX = "zIndex",
        SHIM = "shim",
        VISIBLE = "visible",

        BOUNDING_BOX = "boundingBox",

        RENDER_UI = "renderUI",
        BIND_UI = "bindUI",
        SYNC_UI = "syncUI",

        OFFSET_WIDTH = "offsetWidth",
        OFFSET_HEIGHT = "offsetHeight",
        PARENT_NODE = "parentNode",
        FIRST_CHILD = "firstChild",
        OWNER_DOCUMENT = "ownerDocument",

        WIDTH = "width",
        HEIGHT = "height",
        PX = "px",

        // HANDLE KEYS
        SHIM_DEFERRED = "shimdeferred",
        SHIM_RESIZE = "shimresize",

        // Events
        VisibleChange = "visibleChange",
        WidthChange = "widthChange",
        HeightChange = "heightChange",
        ShimChange = "shimChange",
        ZIndexChange = "zIndexChange",
        ContentUpdate = "contentUpdate",

        // CSS
        STACKED = "stacked";

    /**
     * Widget extension, which can be used to add stackable (z-index) support to the
     * base Widget class along with a shimming solution, through the
     * <a href="Base.html#method_build">Base.build</a> method.
     *
     * @class WidgetStack
     * @param {Object} User configuration object
     */
    function Stack(config) {}

    // Static Properties
    /**
     * Static property used to define the default attribute
     * configuration introduced by WidgetStack.
     *
     * @property ATTRS
     * @type Object
     * @static
     */
    Stack.ATTRS = {
        /**
         * @attribute shim
         * @type boolean
         * @default false, for all browsers other than IE6, for which a shim is enabled by default.
         *
         * @description Boolean flag to indicate whether or not a shim should be added to the Widgets
         * boundingBox, to protect it from select box bleedthrough.
         */
        shim: {
            value: (UA.ie == 6)
        },

        /**
         * @attribute zIndex
         * @type number
         * @default 0
         * @description The z-index to apply to the Widgets boundingBox. Non-numerical values for
         * zIndex will be converted to 0
         */
        zIndex: {
            value : 0,
            setter: '_setZIndex'
        }
    };

    /**
     * The HTML parsing rules for the WidgetStack class.
     *
     * @property HTML_PARSER
     * @static
     * @type Object
     */
    Stack.HTML_PARSER = {
        zIndex: function (srcNode) {
            return this._parseZIndex(srcNode);
        }
    };

    /**
     * Default class used to mark the shim element
     *
     * @property SHIM_CLASS_NAME
     * @type String
     * @static
     * @default "yui3-widget-shim"
     */
    Stack.SHIM_CLASS_NAME = Widget.getClassName(SHIM);

    /**
     * Default class used to mark the boundingBox of a stacked widget.
     *
     * @property STACKED_CLASS_NAME
     * @type String
     * @static
     * @default "yui3-widget-stacked"
     */
    Stack.STACKED_CLASS_NAME = Widget.getClassName(STACKED);

    /**
     * Default markup template used to generate the shim element.
     *
     * @property SHIM_TEMPLATE
     * @type String
     * @static
     */
    Stack.SHIM_TEMPLATE = '<iframe class="' + Stack.SHIM_CLASS_NAME + '" frameborder="0" title="Widget Stacking Shim" src="javascript:false" tabindex="-1" role="presentation"></iframe>';

    Stack.prototype = {

        initializer : function() {
            this._stackNode = this.get(BOUNDING_BOX);
            this._stackHandles = {};

            // WIDGET METHOD OVERLAP
            Y.after(this._renderUIStack, this, RENDER_UI);
            Y.after(this._syncUIStack, this, SYNC_UI);
            Y.after(this._bindUIStack, this, BIND_UI);
        },

        /**
         * Synchronizes the UI to match the Widgets stack state. This method in
         * invoked after syncUI is invoked for the Widget class using YUI's aop infrastructure.
         *
         * @method _syncUIStack
         * @protected
         */
        _syncUIStack: function() {
            this._uiSetShim(this.get(SHIM));
            this._uiSetZIndex(this.get(ZINDEX));
        },

        /**
         * Binds event listeners responsible for updating the UI state in response to
         * Widget stack related state changes.
         * <p>
         * This method is invoked after bindUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _bindUIStack
         * @protected
         */
        _bindUIStack: function() {
            this.after(ShimChange, this._afterShimChange);
            this.after(ZIndexChange, this._afterZIndexChange);
        },

        /**
         * Creates/Initializes the DOM to support stackability.
         * <p>
         * This method in invoked after renderUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _renderUIStack
         * @protected
         */
        _renderUIStack: function() {
            this._stackNode.addClass(Stack.STACKED_CLASS_NAME);
        },

        /**
        Parses a `zIndex` attribute value from this widget's `srcNode`.

        @method _parseZIndex
        @param {Node} srcNode The node to parse a `zIndex` value from.
        @return {Mixed} The parsed `zIndex` value.
        @protected
        **/
        _parseZIndex: function (srcNode) {
            var zIndex;

            // Prefers how WebKit handles `z-index` which better matches the
            // spec:
            //
            // * http://www.w3.org/TR/CSS2/visuren.html#z-index
            // * https://bugs.webkit.org/show_bug.cgi?id=15562
            //
            // When a node isn't rendered in the document, and/or when a
            // node is not positioned, then it doesn't have a context to derive
            // a valid `z-index` value from.
            if (!srcNode.inDoc() || srcNode.getStyle('position') === 'static') {
                zIndex = 'auto';
            } else {
                // Uses `getComputedStyle()` because it has greater accuracy in
                // more browsers than `getStyle()` does for `z-index`.
                zIndex = srcNode.getComputedStyle('zIndex');
            }

            // This extension adds a stacking context to widgets, therefore a
            // `srcNode` witout a stacking context (i.e. "auto") will return
            // `null` from this DOM parser. This way the widget's default or
            // user provided value for `zIndex` will be used.
            return zIndex === 'auto' ? null : zIndex;
        },

        /**
         * Default setter for zIndex attribute changes. Normalizes zIndex values to
         * numbers, converting non-numerical values to 0.
         *
         * @method _setZIndex
         * @protected
         * @param {String | Number} zIndex
         * @return {Number} Normalized zIndex
         */
        _setZIndex: function(zIndex) {
            if (L.isString(zIndex)) {
                zIndex = parseInt(zIndex, 10);
            }
            if (!L.isNumber(zIndex)) {
                zIndex = 0;
            }
            return zIndex;
        },

        /**
         * Default attribute change listener for the shim attribute, responsible
         * for updating the UI, in response to attribute changes.
         *
         * @method _afterShimChange
         * @protected
         * @param {EventFacade} e The event facade for the attribute change
         */
        _afterShimChange : function(e) {
            this._uiSetShim(e.newVal);
        },

        /**
         * Default attribute change listener for the zIndex attribute, responsible
         * for updating the UI, in response to attribute changes.
         *
         * @method _afterZIndexChange
         * @protected
         * @param {EventFacade} e The event facade for the attribute change
         */
        _afterZIndexChange : function(e) {
            this._uiSetZIndex(e.newVal);
        },

        /**
         * Updates the UI to reflect the zIndex value passed in.
         *
         * @method _uiSetZIndex
         * @protected
         * @param {number} zIndex The zindex to be reflected in the UI
         */
        _uiSetZIndex: function (zIndex) {
            this._stackNode.setStyle(ZINDEX, zIndex);
        },

        /**
         * Updates the UI to enable/disable the shim. If the widget is not currently visible,
         * creation of the shim is deferred until it is made visible, for performance reasons.
         *
         * @method _uiSetShim
         * @protected
         * @param {boolean} enable If true, creates/renders the shim, if false, removes it.
         */
        _uiSetShim: function (enable) {
            if (enable) {
                // Lazy creation
                if (this.get(VISIBLE)) {
                    this._renderShim();
                } else {
                    this._renderShimDeferred();
                }

                // Eagerly attach resize handlers
                //
                // Required because of Event stack behavior, commit ref: cd8dddc
                // Should be revisted after Ticket #2531067 is resolved.
                if (UA.ie == 6) {
                    this._addShimResizeHandlers();
                }
            } else {
                this._destroyShim();
            }
        },

        /**
         * Sets up change handlers for the visible attribute, to defer shim creation/rendering
         * until the Widget is made visible.
         *
         * @method _renderShimDeferred
         * @private
         */
        _renderShimDeferred : function() {

            this._stackHandles[SHIM_DEFERRED] = this._stackHandles[SHIM_DEFERRED] || [];

            var handles = this._stackHandles[SHIM_DEFERRED],
                createBeforeVisible = function(e) {
                    if (e.newVal) {
                        this._renderShim();
                    }
                };

            handles.push(this.on(VisibleChange, createBeforeVisible));
            // Depending how how Ticket #2531067 is resolved, a reversal of
            // commit ref: cd8dddc could lead to a more elagent solution, with
            // the addition of this line here:
            //
            // handles.push(this.after(VisibleChange, this.sizeShim));
        },

        /**
         * Sets up event listeners to resize the shim when the size of the Widget changes.
         * <p>
         * NOTE: This method is only used for IE6 currently, since IE6 doesn't support a way to
         * resize the shim purely through CSS, when the Widget does not have an explicit width/height
         * set.
         * </p>
         * @method _addShimResizeHandlers
         * @private
         */
        _addShimResizeHandlers : function() {

            this._stackHandles[SHIM_RESIZE] = this._stackHandles[SHIM_RESIZE] || [];

            var sizeShim = this.sizeShim,
                handles = this._stackHandles[SHIM_RESIZE];

            handles.push(this.after(VisibleChange, sizeShim));
            handles.push(this.after(WidthChange, sizeShim));
            handles.push(this.after(HeightChange, sizeShim));
            handles.push(this.after(ContentUpdate, sizeShim));
        },

        /**
         * Detaches any handles stored for the provided key
         *
         * @method _detachStackHandles
         * @param String handleKey The key defining the group of handles which should be detached
         * @private
         */
        _detachStackHandles : function(handleKey) {
            var handles = this._stackHandles[handleKey],
                handle;

            if (handles && handles.length > 0) {
                while((handle = handles.pop())) {
                    handle.detach();
                }
            }
        },

        /**
         * Creates the shim element and adds it to the DOM
         *
         * @method _renderShim
         * @private
         */
        _renderShim : function() {
            var shimEl = this._shimNode,
                stackEl = this._stackNode;

            if (!shimEl) {
                shimEl = this._shimNode = this._getShimTemplate();
                stackEl.insertBefore(shimEl, stackEl.get(FIRST_CHILD));

                this._detachStackHandles(SHIM_DEFERRED);
                this.sizeShim();
            }
        },

        /**
         * Removes the shim from the DOM, and detaches any related event
         * listeners.
         *
         * @method _destroyShim
         * @private
         */
        _destroyShim : function() {
            if (this._shimNode) {
                this._shimNode.get(PARENT_NODE).removeChild(this._shimNode);
                this._shimNode = null;

                this._detachStackHandles(SHIM_DEFERRED);
                this._detachStackHandles(SHIM_RESIZE);
            }
        },

        /**
         * For IE6, synchronizes the size and position of iframe shim to that of
         * Widget bounding box which it is protecting. For all other browsers,
         * this method does not do anything.
         *
         * @method sizeShim
         */
        sizeShim: function () {
            var shim = this._shimNode,
                node = this._stackNode;

            if (shim && UA.ie === 6 && this.get(VISIBLE)) {
                shim.setStyle(WIDTH, node.get(OFFSET_WIDTH) + PX);
                shim.setStyle(HEIGHT, node.get(OFFSET_HEIGHT) + PX);
            }
        },

        /**
         * Creates a cloned shim node, using the SHIM_TEMPLATE html template, for use on a new instance.
         *
         * @method _getShimTemplate
         * @private
         * @return {Node} node A new shim Node instance.
         */
        _getShimTemplate : function() {
            return Node.create(Stack.SHIM_TEMPLATE, this._stackNode.get(OWNER_DOCUMENT));
        }
    };

    Y.WidgetStack = Stack;


}, '3.17.1', {"requires": ["base-build", "widget"], "skinnable": true});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('widget-position', function (Y, NAME) {

/**
 * Provides basic XY positioning support for Widgets, though an extension
 *
 * @module widget-position
 */
    var Lang = Y.Lang,
        Widget = Y.Widget,

        XY_COORD = "xy",

        POSITION = "position",
        POSITIONED = "positioned",
        BOUNDING_BOX = "boundingBox",
        RELATIVE = "relative",

        RENDERUI = "renderUI",
        BINDUI = "bindUI",
        SYNCUI = "syncUI",

        UI = Widget.UI_SRC,

        XYChange = "xyChange";

    /**
     * Widget extension, which can be used to add positioning support to the base Widget class,
     * through the <a href="Base.html#method_build">Base.build</a> method.
     *
     * @class WidgetPosition
     * @param {Object} config User configuration object
     */
    function Position(config) {
    }

    /**
     * Static property used to define the default attribute
     * configuration introduced by WidgetPosition.
     *
     * @property ATTRS
     * @static
     * @type Object
     */
    Position.ATTRS = {

        /**
         * @attribute x
         * @type number
         * @default 0
         *
         * @description Page X co-ordinate for the widget. This attribute acts as a facade for the
         * xy attribute. Changes in position can be monitored by listening for xyChange events.
         */
        x: {
            setter: function(val) {
                this._setX(val);
            },
            getter: function() {
                return this._getX();
            },
            lazyAdd:false
        },

        /**
         * @attribute y
         * @type number
         * @default 0
         *
         * @description Page Y co-ordinate for the widget. This attribute acts as a facade for the
         * xy attribute. Changes in position can be monitored by listening for xyChange events.
         */
        y: {
            setter: function(val) {
                this._setY(val);
            },
            getter: function() {
                return this._getY();
            },
            lazyAdd: false
        },

        /**
         * @attribute xy
         * @type Array
         * @default [0,0]
         *
         * @description Page XY co-ordinate pair for the widget.
         */
        xy: {
            value:[0,0],
            validator: function(val) {
                return this._validateXY(val);
            }
        }
    };

    /**
     * Default class used to mark the boundingBox of a positioned widget.
     *
     * @property POSITIONED_CLASS_NAME
     * @type String
     * @default "yui-widget-positioned"
     * @static
     */
    Position.POSITIONED_CLASS_NAME = Widget.getClassName(POSITIONED);

    Position.prototype = {

        initializer : function() {
            this._posNode = this.get(BOUNDING_BOX);

            // WIDGET METHOD OVERLAP
            Y.after(this._renderUIPosition, this, RENDERUI);
            Y.after(this._syncUIPosition, this, SYNCUI);
            Y.after(this._bindUIPosition, this, BINDUI);
        },

        /**
         * Creates/Initializes the DOM to support xy page positioning.
         * <p>
         * This method in invoked after renderUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _renderUIPosition
         * @protected
         */
        _renderUIPosition : function() {
            this._posNode.addClass(Position.POSITIONED_CLASS_NAME);
        },

        /**
         * Synchronizes the UI to match the Widgets xy page position state.
         * <p>
         * This method in invoked after syncUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _syncUIPosition
         * @protected
         */
        _syncUIPosition : function() {
            var posNode = this._posNode;
            if (posNode.getStyle(POSITION) === RELATIVE) {
                this.syncXY();
            }
            this._uiSetXY(this.get(XY_COORD));
        },

        /**
         * Binds event listeners responsible for updating the UI state in response to
         * Widget position related state changes.
         * <p>
         * This method in invoked after bindUI is invoked for the Widget class
         * using YUI's aop infrastructure.
         * </p>
         * @method _bindUIPosition
         * @protected
         */
        _bindUIPosition :function() {
            this.after(XYChange, this._afterXYChange);
        },

        /**
         * Moves the Widget to the specified page xy co-ordinate position.
         *
         * @method move
         *
         * @param {Number|Number[]} x The new x position or [x, y] values passed
         * as an array to support simple pass through of Node.getXY results
         * @param {Number} [y] The new y position
         */
        move: function () {
            var args = arguments,
                coord = (Lang.isArray(args[0])) ? args[0] : [args[0], args[1]];
                this.set(XY_COORD, coord);
        },

        /**
         * Synchronizes the Panel's "xy", "x", and "y" properties with the
         * Widget's position in the DOM.
         *
         * @method syncXY
         */
        syncXY : function () {
            this.set(XY_COORD, this._posNode.getXY(), {src: UI});
        },

        /**
         * Default validator for the XY attribute
         *
         * @method _validateXY
         * @protected
         * @param {Array} val The XY page co-ordinate value which is being set.
         * @return {boolean} true if valid, false if not.
         */
        _validateXY : function(val) {
            return (Lang.isArray(val) && Lang.isNumber(val[0]) && Lang.isNumber(val[1]));
        },

        /**
         * Default setter for the X attribute. The setter passes the X value through
         * to the XY attribute, which is the sole store for the XY state.
         *
         * @method _setX
         * @protected
         * @param {Number} val The X page co-ordinate value
         */
        _setX : function(val) {
            this.set(XY_COORD, [val, this.get(XY_COORD)[1]]);
        },

        /**
         * Default setter for the Y attribute. The setter passes the Y value through
         * to the XY attribute, which is the sole store for the XY state.
         *
         * @method _setY
         * @protected
         * @param {Number} val The Y page co-ordinate value
         */
        _setY : function(val) {
            this.set(XY_COORD, [this.get(XY_COORD)[0], val]);
        },

        /**
         * Default getter for the X attribute. The value is retrieved from
         * the XY attribute, which is the sole store for the XY state.
         *
         * @method _getX
         * @protected
         * @return {Number} The X page co-ordinate value
         */
        _getX : function() {
            return this.get(XY_COORD)[0];
        },

        /**
         * Default getter for the Y attribute. The value is retrieved from
         * the XY attribute, which is the sole store for the XY state.
         *
         * @method _getY
         * @protected
         * @return {Number} The Y page co-ordinate value
         */
        _getY : function() {
            return this.get(XY_COORD)[1];
        },

        /**
         * Default attribute change listener for the xy attribute, responsible
         * for updating the UI, in response to attribute changes.
         *
         * @method _afterXYChange
         * @protected
         * @param {EventFacade} e The event facade for the attribute change
         */
        _afterXYChange : function(e) {
            if (e.src != UI) {
                this._uiSetXY(e.newVal);
            }
        },

        /**
         * Updates the UI to reflect the XY page co-ordinates passed in.
         *
         * @method _uiSetXY
         * @protected
         * @param {String} val The XY page co-ordinates value to be reflected in the UI
         */
        _uiSetXY : function(val) {
            this._posNode.setXY(val);
        }
    };

    Y.WidgetPosition = Position;


}, '3.17.1', {"requires": ["base-build", "node-screen", "widget"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('panel', function (Y, NAME) {

// TODO: Change this description!
/**
Provides a Panel widget, a widget that mimics the functionality of a regular OS
window. Comes with Standard Module support, XY Positioning, Alignment Support,
Stack (z-index) support, modality, auto-focus and auto-hide functionality, and
header/footer button support.

@module panel
**/

var getClassName = Y.ClassNameManager.getClassName;

// TODO: Change this description!
/**
A basic Panel Widget, which can be positioned based on Page XY co-ordinates and
is stackable (z-index support). It also provides alignment and centering support
and uses a standard module format for it's content, with header, body and footer
section support. It can be made modal, and has functionality to hide and focus
on different events. The header and footer sections can be modified to allow for
button support.

@class Panel
@constructor
@extends Widget
@uses WidgetAutohide
@uses WidgetButtons
@uses WidgetModality
@uses WidgetPosition
@uses WidgetPositionAlign
@uses WidgetPositionConstrain
@uses WidgetStack
@uses WidgetStdMod
@since 3.4.0
 */
Y.Panel = Y.Base.create('panel', Y.Widget, [
    // Other Widget extensions depend on these two.
    Y.WidgetPosition,
    Y.WidgetStdMod,

    Y.WidgetAutohide,
    Y.WidgetButtons,
    Y.WidgetModality,
    Y.WidgetPositionAlign,
    Y.WidgetPositionConstrain,
    Y.WidgetStack
], {
    // -- Public Properties ----------------------------------------------------

    /**
    Collection of predefined buttons mapped from name => config.

    Panel includes a "close" button which can be use by name. When the close
    button is in the header (which is the default), it will look like: [x].

    See `addButton()` for a list of possible configuration values.

    @example
        // Panel with close button in header.
        var panel = new Y.Panel({
            buttons: ['close']
        });

        // Panel with close button in footer.
        var otherPanel = new Y.Panel({
            buttons: {
                footer: ['close']
            }
        });

    @property BUTTONS
    @type Object
    @default {close: {}}
    @since 3.5.0
    **/
    BUTTONS: {
        close: {
            label  : 'Close',
            action : 'hide',
            section: 'header',

            // Uses `type="button"` so the button's default action can still
            // occur but it won't cause things like a form to submit.
            template  : '<button type="button" />',
            classNames: getClassName('button', 'close')
        }
    }
}, {
    ATTRS: {
        // TODO: API Docs.
        buttons: {
            value: ['close']
        }
    }
});


}, '3.17.1', {
    "requires": [
        "widget",
        "widget-autohide",
        "widget-buttons",
        "widget-modality",
        "widget-position",
        "widget-position-align",
        "widget-position-constrain",
        "widget-stack",
        "widget-stdmod"
    ],
    "skinnable": true
});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('datatype-number-parse', function (Y, NAME) {

/**
 * Parse number submodule.
 *
 * @module datatype-number
 * @submodule datatype-number-parse
 * @for Number
 */

var safe = Y.Escape.regex,
    SPACES = '\\s*';

Y.mix(Y.namespace("Number"), {
    /**
     * Returns a parsing function for the given configuration.
     * It uses `Y.cached` so it expects the format spec separated into
     * individual values.
     * The method further uses closure to put together and save the
     * regular expresssion just once in the outer function.
     *
     * @method _buildParser
     * @param [prefix] {String} Prefix string to be stripped out.
     * @param [suffix] {String} Suffix string to be stripped out.
     * @param [separator] {String} Thousands separator to be stripped out.
     * @param [decimal] {String} Decimal separator to be replaced by a dot.
     * @return {Function} Parsing function.
     * @private
     */
    _buildParser: Y.cached(function (prefix, suffix, separator, decimal) {
        var regexBits = [],
            regex;

        if (prefix) {
            regexBits.push('^' + SPACES + safe(prefix) + SPACES);
        }
        if (suffix) {
            regexBits.push(SPACES + safe(suffix) + SPACES + '$');
        }
        if (separator) {
            regexBits.push(safe(separator) + '(?=\\d)');
        }

        regex = new RegExp('(?:' + regexBits.join('|') + ')', 'g');

        if (decimal === '.') {
            decimal = null;
        }
        return function (val) {
            val = val.replace(regex, '');

            return decimal ? val.replace(decimal, '.') : val;
        };
    }),
    /**
     * Converts data to type Number.
     * If a `config` argument is used, it will strip the `data` of the prefix,
     * the suffix and the thousands separator, if any of them are found,
     * replace the decimal separator by a dot and parse the resulting string.
     * Extra whitespace around the prefix and suffix will be ignored.
     *
     * @method parse
     * @param data {String | Number | Boolean} Data to convert. The following
     * values return as null: null, undefined, NaN, "".
     * @param [config] {Object} Optional configuration values, same as for [Y.Date.format](#method_format).
     * @param [config.prefix] {String} String to be removed from the start, like a currency designator "$"
     * @param [config.decimalPlaces] {Number} Ignored, it is accepted only for compatibility with [Y.Date.format](#method_format).
     * @param [config.decimalSeparator] {String} Decimal separator.
     * @param [config.thousandsSeparator] {String} Thousands separator.
     * @param [config.suffix] {String} String to be removed from the end of the number, like " items".
     * @return {Number} A number, or null.
     */

    parse: function(data, config) {
        var parser;

        if (config && typeof data === 'string') {
            parser = this._buildParser(config.prefix, config.suffix, config.thousandsSeparator, config.decimalSeparator);

            data = parser(data);
        }

        if (typeof data === 'string' && Y.Lang.trim(data) !== '') {
            data = +data;
        }
        
        // catch NaN and ±Infinity
        if (typeof data !== 'number' || !isFinite(data)) {
            data = null;
        }

        // on the same line to get stripped for raw/min.js by build system

        return data;
    }
});

// Add Parsers shortcut
Y.namespace("Parsers").number = Y.Number.parse;
Y.namespace("DataType");
Y.DataType.Number = Y.Number;


}, '3.17.1', {"requires": ["escape"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('json-parse', function (Y, NAME) {

var _JSON = Y.config.global.JSON;

Y.namespace('JSON').parse = function (obj, reviver, space) {
    return _JSON.parse((typeof obj === 'string' ? obj : obj + ''), reviver, space);
};


}, '3.17.1', {"requires": ["yui-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('datatype-number-format', function (Y, NAME) {

/**
 * The Number Utility provides type-conversion and string-formatting
 * convenience methods for Numbers.
 *
 * @module datatype-number
 * @main datatype-number
 */

/**
 * Format number submodule.
 *
 * @module datatype-number
 * @submodule datatype-number-format
 */

/**
 * Number provides a set of utility functions to operate against Number objects.
 *
 * @class Number
 * @static
 */
var LANG = Y.Lang;

Y.mix(Y.namespace("Number"), {
     /**
     * Takes a Number and formats to string for display to user.
     *
     * @method format
     * @param data {Number} Number.
     * @param config {Object} (Optional) Optional configuration values:
     *  <dl>
     *   <dt>prefix {String}</dd>
     *   <dd>String prepended before each number, like a currency designator "$"</dd>
     *   <dt>decimalPlaces {Number}</dd>
     *   <dd>Number of decimal places to round. Must be a number 0 to 20.</dd>
     *   <dt>decimalSeparator {String}</dd>
     *   <dd>Decimal separator</dd>
     *   <dt>thousandsSeparator {String}</dd>
     *   <dd>Thousands separator</dd>
     *   <dt>suffix {String}</dd>
     *   <dd>String appended after each number, like " items" (note the space)</dd>
     *  </dl>
     * @return {String} Formatted number for display. Note, the following values
     * return as "": null, undefined, NaN, "".
     */
    format: function(data, config) {
        if(LANG.isNumber(data)) {
            config = config || {};

            var isNeg = (data < 0),
                output = data + "",
                decPlaces = config.decimalPlaces,
                decSep = config.decimalSeparator || ".",
                thouSep = config.thousandsSeparator,
                decIndex,
                newOutput, count, i;

            // Decimal precision
            if(LANG.isNumber(decPlaces) && (decPlaces >= 0) && (decPlaces <= 20)) {
                // Round to the correct decimal place
                output = data.toFixed(decPlaces);
            }

            // Decimal separator
            if(decSep !== "."){
                output = output.replace(".", decSep);
            }

            // Add the thousands separator
            if(thouSep) {
                // Find the dot or where it would be
                decIndex = output.lastIndexOf(decSep);
                decIndex = (decIndex > -1) ? decIndex : output.length;
                // Start with the dot and everything to the right
                newOutput = output.substring(decIndex);
                // Working left, every third time add a separator, every time add a digit
                for (count = 0, i=decIndex; i>0; i--) {
                    if ((count%3 === 0) && (i !== decIndex) && (!isNeg || (i > 1))) {
                        newOutput = thouSep + newOutput;
                    }
                    newOutput = output.charAt(i-1) + newOutput;
                    count++;
                }
                output = newOutput;
            }

            // Prepend prefix
            output = (config.prefix) ? config.prefix + output : output;

            // Append suffix
            output = (config.suffix) ? output + config.suffix : output;

            return output;
        }
        // Not a Number, just return as string
        else {
            return (LANG.isValue(data) && data.toString) ? data.toString() : "";
        }
    }
});

Y.namespace("DataType");
Y.DataType.Number = Y.Number;


}, '3.17.1');
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('querystring-stringify-simple', function (Y, NAME) {

/*global Y */
/**
 * <p>Provides Y.QueryString.stringify method for converting objects to Query Strings.
 * This is a subset implementation of the full querystring-stringify.</p>
 * <p>This module provides the bare minimum functionality (encoding a hash of simple values),
 * without the additional support for nested data structures.  Every key-value pair is
 * encoded by encodeURIComponent.</p>
 * <p>This module provides a minimalistic way for io to handle  single-level objects
 * as transaction data.</p>
 *
 * @module querystring
 * @submodule querystring-stringify-simple
 */

var QueryString = Y.namespace("QueryString"),
    EUC = encodeURIComponent;


QueryString.stringify = function (obj, c) {
    var qs = [],
        // Default behavior is false; standard key notation.
        s = c && c.arrayKey ? true : false,
        key, i, l;

    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (Y.Lang.isArray(obj[key])) {
                for (i = 0, l = obj[key].length; i < l; i++) {
                    qs.push(EUC(s ? key + '[]' : key) + '=' + EUC(obj[key][i]));
                }
            }
            else {
                qs.push(EUC(key) + '=' + EUC(obj[key]));
            }
        }
    }

    return qs.join('&');
};


}, '3.17.1', {"requires": ["yui-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('io-base', function (Y, NAME) {

/**
Base IO functionality. Provides basic XHR transport support.

@module io
@submodule io-base
@for IO
**/

var // List of events that comprise the IO event lifecycle.
    EVENTS = ['start', 'complete', 'end', 'success', 'failure', 'progress'],

    // Whitelist of used XHR response object properties.
    XHR_PROPS = ['status', 'statusText', 'responseText', 'responseXML'],

    win = Y.config.win,
    uid = 0;

/**
The IO class is a utility that brokers HTTP requests through a simplified
interface.  Specifically, it allows JavaScript to make HTTP requests to
a resource without a page reload.  The underlying transport for making
same-domain requests is the XMLHttpRequest object.  IO can also use
Flash, if specified as a transport, for cross-domain requests.

@class IO
@constructor
@param {Object} config Object of EventTarget's publish method configurations
                    used to configure IO's events.
**/
function IO (config) {
    var io = this;

    io._uid = 'io:' + uid++;
    io._init(config);
    Y.io._map[io._uid] = io;
}

IO.prototype = {
    //--------------------------------------
    //  Properties
    //--------------------------------------

   /**
    * A counter that increments for each transaction.
    *
    * @property _id
    * @private
    * @type {Number}
    */
    _id: 0,

   /**
    * Object of IO HTTP headers sent with each transaction.
    *
    * @property _headers
    * @private
    * @type {Object}
    */
    _headers: {
        'X-Requested-With' : 'XMLHttpRequest'
    },

   /**
    * Object that stores timeout values for any transaction with a defined
    * "timeout" configuration property.
    *
    * @property _timeout
    * @private
    * @type {Object}
    */
    _timeout: {},

    //--------------------------------------
    //  Methods
    //--------------------------------------

    _init: function(config) {
        var io = this, i, len;

        io.cfg = config || {};

        Y.augment(io, Y.EventTarget);
        for (i = 0, len = EVENTS.length; i < len; ++i) {
            // Publish IO global events with configurations, if any.
            // IO global events are set to broadcast by default.
            // These events use the "io:" namespace.
            io.publish('io:' + EVENTS[i], Y.merge({ broadcast: 1 }, config));
            // Publish IO transaction events with configurations, if
            // any.  These events use the "io-trn:" namespace.
            io.publish('io-trn:' + EVENTS[i], config);
        }
    },

   /**
    * Method that creates a unique transaction object for each request.
    *
    * @method _create
    * @private
    * @param {Object} cfg Configuration object subset to determine if
    *                 the transaction is an XDR or file upload,
    *                 requiring an alternate transport.
    * @param {Number} id Transaction id
    * @return {Object} The transaction object
    */
    _create: function(config, id) {
        var io = this,
            transaction = {
                id : Y.Lang.isNumber(id) ? id : io._id++,
                uid: io._uid
            },
            alt = config.xdr ? config.xdr.use : null,
            form = config.form && config.form.upload ? 'iframe' : null,
            use;

        if (alt === 'native') {
            // Non-IE and IE >= 10  can use XHR level 2 and not rely on an
            // external transport.
            alt = Y.UA.ie && !SUPPORTS_CORS ? 'xdr' : null;

            // Prevent "pre-flight" OPTIONS request by removing the
            // `X-Requested-With` HTTP header from CORS requests. This header
            // can be added back on a per-request basis, if desired.
            io.setHeader('X-Requested-With');
        }

        use = alt || form;
        transaction = use ? Y.merge(Y.IO.customTransport(use), transaction) :
                            Y.merge(Y.IO.defaultTransport(), transaction);

        if (transaction.notify) {
            config.notify = function (e, t, c) { io.notify(e, t, c); };
        }

        if (!use) {
            if (win && win.FormData && config.data instanceof win.FormData) {
                transaction.c.upload.onprogress = function (e) {
                    io.progress(transaction, e, config);
                };
                transaction.c.onload = function (e) {
                    io.load(transaction, e, config);
                };
                transaction.c.onerror = function (e) {
                    io.error(transaction, e, config);
                };
                transaction.upload = true;
            }
        }

        return transaction;
    },

    _destroy: function(transaction) {
        if (win && !transaction.notify && !transaction.xdr) {
            if (XHR && !transaction.upload) {
                transaction.c.onreadystatechange = null;
            } else if (transaction.upload) {
                transaction.c.upload.onprogress = null;
                transaction.c.onload = null;
                transaction.c.onerror = null;
            } else if (Y.UA.ie && !transaction.e) {
                // IE, when using XMLHttpRequest as an ActiveX Object, will throw
                // a "Type Mismatch" error if the event handler is set to "null".
                transaction.c.abort();
            }
        }

        transaction = transaction.c = null;
    },

   /**
    * Method for creating and firing events.
    *
    * @method _evt
    * @private
    * @param {String} eventName Event to be published.
    * @param {Object} transaction Transaction object.
    * @param {Object} config Configuration data subset for event subscription.
    */
    _evt: function(eventName, transaction, config) {
        var io          = this, params,
            args        = config['arguments'],
            emitFacade  = io.cfg.emitFacade,
            globalEvent = "io:" + eventName,
            trnEvent    = "io-trn:" + eventName;

        // Workaround for #2532107
        this.detach(trnEvent);

        if (transaction.e) {
            transaction.c = { status: 0, statusText: transaction.e };
        }

        // Fire event with parameters or an Event Facade.
        params = [ emitFacade ?
            {
                id: transaction.id,
                data: transaction.c,
                cfg: config,
                'arguments': args
            } :
            transaction.id
        ];

        if (!emitFacade) {
            if (eventName === EVENTS[0] || eventName === EVENTS[2]) {
                if (args) {
                    params.push(args);
                }
            } else {
                if (transaction.evt) {
                    params.push(transaction.evt);
                } else {
                    params.push(transaction.c);
                }
                if (args) {
                    params.push(args);
                }
            }
        }

        params.unshift(globalEvent);
        // Fire global events.
        io.fire.apply(io, params);
        // Fire transaction events, if receivers are defined.
        if (config.on) {
            params[0] = trnEvent;
            io.once(trnEvent, config.on[eventName], config.context || Y);
            io.fire.apply(io, params);
        }
    },

   /**
    * Fires event "io:start" and creates, fires a transaction-specific
    * start event, if `config.on.start` is defined.
    *
    * @method start
    * @param {Object} transaction Transaction object.
    * @param {Object} config Configuration object for the transaction.
    */
    start: function(transaction, config) {
       /**
        * Signals the start of an IO request.
        * @event io:start
        */
        this._evt(EVENTS[0], transaction, config);
    },

   /**
    * Fires event "io:complete" and creates, fires a
    * transaction-specific "complete" event, if config.on.complete is
    * defined.
    *
    * @method complete
    * @param {Object} transaction Transaction object.
    * @param {Object} config Configuration object for the transaction.
    */
    complete: function(transaction, config) {
       /**
        * Signals the completion of the request-response phase of a
        * transaction. Response status and data are accessible, if
        * available, in this event.
        * @event io:complete
        */
        this._evt(EVENTS[1], transaction, config);
    },

   /**
    * Fires event "io:end" and creates, fires a transaction-specific "end"
    * event, if config.on.end is defined.
    *
    * @method end
    * @param {Object} transaction Transaction object.
    * @param {Object} config Configuration object for the transaction.
    */
    end: function(transaction, config) {
       /**
        * Signals the end of the transaction lifecycle.
        * @event io:end
        */
        this._evt(EVENTS[2], transaction, config);
        this._destroy(transaction);
    },

   /**
    * Fires event "io:success" and creates, fires a transaction-specific
    * "success" event, if config.on.success is defined.
    *
    * @method success
    * @param {Object} transaction Transaction object.
    * @param {Object} config Configuration object for the transaction.
    */
    success: function(transaction, config) {
       /**
        * Signals an HTTP response with status in the 2xx range.
        * Fires after io:complete.
        * @event io:success
        */
        this._evt(EVENTS[3], transaction, config);
        this.end(transaction, config);
    },

   /**
    * Fires event "io:failure" and creates, fires a transaction-specific
    * "failure" event, if config.on.failure is defined.
    *
    * @method failure
    * @param {Object} transaction Transaction object.
    * @param {Object} config Configuration object for the transaction.
    */
    failure: function(transaction, config) {
       /**
        * Signals an HTTP response with status outside of the 2xx range.
        * Fires after io:complete.
        * @event io:failure
        */
        this._evt(EVENTS[4], transaction, config);
        this.end(transaction, config);
    },

   /**
    * Fires event "io:progress" and creates, fires a transaction-specific
    * "progress" event -- for XMLHttpRequest file upload -- if
    * config.on.progress is defined.
    *
    * @method progress
    * @param {Object} transaction Transaction object.
    * @param {Object} progress event.
    * @param {Object} config Configuration object for the transaction.
    */
    progress: function(transaction, e, config) {
       /**
        * Signals the interactive state during a file upload transaction.
        * This event fires after io:start and before io:complete.
        * @event io:progress
        */
        transaction.evt = e;
        this._evt(EVENTS[5], transaction, config);
    },

   /**
    * Fires event "io:complete" and creates, fires a transaction-specific
    * "complete" event -- for XMLHttpRequest file upload -- if
    * config.on.complete is defined.
    *
    * @method load
    * @param {Object} transaction Transaction object.
    * @param {Object} load event.
    * @param {Object} config Configuration object for the transaction.
    */
    load: function (transaction, e, config) {
        transaction.evt = e.target;
        this._evt(EVENTS[1], transaction, config);
    },

   /**
    * Fires event "io:failure" and creates, fires a transaction-specific
    * "failure" event -- for XMLHttpRequest file upload -- if
    * config.on.failure is defined.
    *
    * @method error
    * @param {Object} transaction Transaction object.
    * @param {Object} error event.
    * @param {Object} config Configuration object for the transaction.
    */
    error: function (transaction, e, config) {
        transaction.evt = e;
        this._evt(EVENTS[4], transaction, config);
    },

   /**
    * Retry an XDR transaction, using the Flash tranport, if the native
    * transport fails.
    *
    * @method _retry
    * @private
    * @param {Object} transaction Transaction object.
    * @param {String} uri Qualified path to transaction resource.
    * @param {Object} config Configuration object for the transaction.
    */
    _retry: function(transaction, uri, config) {
        this._destroy(transaction);
        config.xdr.use = 'flash';
        return this.send(uri, config, transaction.id);
    },

   /**
    * Method that concatenates string data for HTTP GET transactions.
    *
    * @method _concat
    * @private
    * @param {String} uri URI or root data.
    * @param {String} data Data to be concatenated onto URI.
    * @return {String}
    */
    _concat: function(uri, data) {
        uri += (uri.indexOf('?') === -1 ? '?' : '&') + data;
        return uri;
    },

   /**
    * Stores default client headers for all transactions. If a label is
    * passed with no value argument, the header will be deleted.
    *
    * @method setHeader
    * @param {String} name HTTP header
    * @param {String} value HTTP header value
    */
    setHeader: function(name, value) {
        if (value) {
            this._headers[name] = value;
        } else {
            delete this._headers[name];
        }
    },

   /**
    * Method that sets all HTTP headers to be sent in a transaction.
    *
    * @method _setHeaders
    * @private
    * @param {Object} transaction - XHR instance for the specific transaction.
    * @param {Object} headers - HTTP headers for the specific transaction, as
    *                    defined in the configuration object passed to YUI.io().
    */
    _setHeaders: function(transaction, headers) {
        headers = Y.merge(this._headers, headers);
        Y.Object.each(headers, function(value, name) {
            if (value !== 'disable') {
                transaction.setRequestHeader(name, headers[name]);
            }
        });
    },

   /**
    * Starts timeout count if the configuration object has a defined
    * timeout property.
    *
    * @method _startTimeout
    * @private
    * @param {Object} transaction Transaction object generated by _create().
    * @param {Object} timeout Timeout in milliseconds.
    */
    _startTimeout: function(transaction, timeout) {
        var io = this;

        io._timeout[transaction.id] = setTimeout(function() {
            io._abort(transaction, 'timeout');
        }, timeout);
    },

   /**
    * Clears the timeout interval started by _startTimeout().
    *
    * @method _clearTimeout
    * @private
    * @param {Number} id - Transaction id.
    */
    _clearTimeout: function(id) {
        clearTimeout(this._timeout[id]);
        delete this._timeout[id];
    },

   /**
    * Method that determines if a transaction response qualifies as success
    * or failure, based on the response HTTP status code, and fires the
    * appropriate success or failure events.
    *
    * @method _result
    * @private
    * @static
    * @param {Object} transaction Transaction object generated by _create().
    * @param {Object} config Configuration object passed to io().
    */
    _result: function(transaction, config) {
        var status;
        // Firefox will throw an exception if attempting to access
        // an XHR object's status property, after a request is aborted.
        try {
            status = transaction.c.status;
        } catch(e) {
            status = 0;
        }

        // IE reports HTTP 204 as HTTP 1223.
        if (status >= 200 && status < 300 || status === 304 || status === 1223) {
            this.success(transaction, config);
        } else {
            this.failure(transaction, config);
        }
    },

   /**
    * Event handler bound to onreadystatechange.
    *
    * @method _rS
    * @private
    * @param {Object} transaction Transaction object generated by _create().
    * @param {Object} config Configuration object passed to YUI.io().
    */
    _rS: function(transaction, config) {
        var io = this;

        if (transaction.c.readyState === 4) {
            if (config.timeout) {
                io._clearTimeout(transaction.id);
            }

            // Yield in the event of request timeout or abort.
            setTimeout(function() {
                io.complete(transaction, config);
                io._result(transaction, config);
            }, 0);
        }
    },

   /**
    * Terminates a transaction due to an explicit abort or timeout.
    *
    * @method _abort
    * @private
    * @param {Object} transaction Transaction object generated by _create().
    * @param {String} type Identifies timed out or aborted transaction.
    */
    _abort: function(transaction, type) {
        if (transaction && transaction.c) {
            transaction.e = type;
            transaction.c.abort();
        }
    },

   /**
    * Requests a transaction. `send()` is implemented as `Y.io()`.  Each
    * transaction may include a configuration object.  Its properties are:
    *
    * <dl>
    *   <dt>method</dt>
    *     <dd>HTTP method verb (e.g., GET or POST). If this property is not
    *         not defined, the default value will be GET.</dd>
    *
    *   <dt>data</dt>
    *     <dd>This is the name-value string that will be sent as the
    *     transaction data. If the request is HTTP GET, the data become
    *     part of querystring. If HTTP POST, the data are sent in the
    *     message body.</dd>
    *
    *   <dt>xdr</dt>
    *     <dd>Defines the transport to be used for cross-domain requests.
    *     By setting this property, the transaction will use the specified
    *     transport instead of XMLHttpRequest. The properties of the
    *     transport object are:
    *     <dl>
    *       <dt>use</dt>
    *         <dd>The transport to be used: 'flash' or 'native'</dd>
    *       <dt>dataType</dt>
    *         <dd>Set the value to 'XML' if that is the expected response
    *         content type.</dd>
    *       <dt>credentials</dt>
    *         <dd>Set the value to 'true' to set XHR.withCredentials property to true.</dd>
    *     </dl></dd>
    *
    *   <dt>form</dt>
    *     <dd>Form serialization configuration object.  Its properties are:
    *     <dl>
    *       <dt>id</dt>
    *         <dd>Node object or id of HTML form</dd>
    *       <dt>useDisabled</dt>
    *         <dd>`true` to also serialize disabled form field values
    *         (defaults to `false`)</dd>
    *     </dl></dd>
    *
    *   <dt>on</dt>
    *     <dd>Assigns transaction event subscriptions. Available events are:
    *     <dl>
    *       <dt>start</dt>
    *         <dd>Fires when a request is sent to a resource.</dd>
    *       <dt>complete</dt>
    *         <dd>Fires when the transaction is complete.</dd>
    *       <dt>success</dt>
    *         <dd>Fires when the HTTP response status is within the 2xx
    *         range.</dd>
    *       <dt>failure</dt>
    *         <dd>Fires when the HTTP response status is outside the 2xx
    *         range, if an exception occurs, if the transation is aborted,
    *         or if the transaction exceeds a configured `timeout`.</dd>
    *       <dt>end</dt>
    *         <dd>Fires at the conclusion of the transaction
    *            lifecycle, after `success` or `failure`.</dd>
    *     </dl>
    *
    *     <p>Callback functions for `start` and `end` receive the id of the
    *     transaction as a first argument. For `complete`, `success`, and
    *     `failure`, callbacks receive the id and the response object
    *     (usually the XMLHttpRequest instance).  If the `arguments`
    *     property was included in the configuration object passed to
    *     `Y.io()`, the configured data will be passed to all callbacks as
    *     the last argument.</p>
    *     </dd>
    *
    *   <dt>sync</dt>
    *     <dd>Pass `true` to make a same-domain transaction synchronous.
    *     <strong>CAVEAT</strong>: This will negatively impact the user
    *     experience. Have a <em>very</em> good reason if you intend to use
    *     this.</dd>
    *
    *   <dt>context</dt>
    *     <dd>The "`this'" object for all configured event handlers. If a
    *     specific context is needed for individual callbacks, bind the
    *     callback to a context using `Y.bind()`.</dd>
    *
    *   <dt>headers</dt>
    *     <dd>Object map of transaction headers to send to the server. The
    *     object keys are the header names and the values are the header
    *     values.</dd>
    *
    *   <dt>username</dt>
    *     <dd>Username to use in a HTTP authentication.</dd>
    *
    *   <dt>password</dt>
    *     <dd>Password to use in a HTTP authentication.</dd>
    *
    *   <dt>timeout</dt>
    *     <dd>Millisecond threshold for the transaction before being
    *     automatically aborted.</dd>
    *
    *   <dt>arguments</dt>
    *     <dd>User-defined data passed to all registered event handlers.
    *     This value is available as the second argument in the "start" and
    *     "end" event handlers. It is the third argument in the "complete",
    *     "success", and "failure" event handlers. <strong>Be sure to quote
    *     this property name in the transaction configuration as
    *     "arguments" is a reserved word in JavaScript</strong> (e.g.
    *     `Y.io({ ..., "arguments": stuff })`).</dd>
    * </dl>
    *
    * @method send
    * @public
    * @param {String} uri Qualified path to transaction resource.
    * @param {Object} config Configuration object for the transaction.
    * @param {Number} id Transaction id, if already set.
    * @return {Object}
    */
    send: function(uri, config, id) {
        var transaction, method, i, len, sync, data,
            io = this,
            u = uri,
            response = {};

        config = config ? Y.Object(config) : {};
        transaction = io._create(config, id);
        method = config.method ? config.method.toUpperCase() : 'GET';
        sync = config.sync;
        data = config.data;

        // Serialize a map object into a key-value string using
        // querystring-stringify-simple.
        if ((Y.Lang.isObject(data) && !data.nodeType) && !transaction.upload) {
            if (Y.QueryString && Y.QueryString.stringify) {
                config.data = data = Y.QueryString.stringify(data);
            } else {
            }
        }

        if (config.form) {
            if (config.form.upload) {
                // This is a file upload transaction, calling
                // upload() in io-upload-iframe.
                return io.upload(transaction, uri, config);
            } else {
                // Serialize HTML form data into a key-value string.
                data = io._serialize(config.form, data);
            }
        }

        // Convert falsy values to an empty string. This way IE can't be
        // rediculous and translate `undefined` to "undefined".
        data || (data = '');

        if (data) {
            switch (method) {
                case 'GET':
                case 'HEAD':
                case 'DELETE':
                    u = io._concat(u, data);
                    data = '';
                    break;
                case 'POST':
                case 'PUT':
                    // If Content-Type is defined in the configuration object, or
                    // or as a default header, it will be used instead of
                    // 'application/x-www-form-urlencoded; charset=UTF-8'
                    config.headers = Y.merge({
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                    }, config.headers);
                    break;
            }
        }

        if (transaction.xdr) {
            // Route data to io-xdr module for flash and XDomainRequest.
            return io.xdr(u, transaction, config);
        }
        else if (transaction.notify) {
            // Route data to custom transport
            return transaction.c.send(transaction, uri, config);
        }

        if (!sync && !transaction.upload) {
            transaction.c.onreadystatechange = function() {
                io._rS(transaction, config);
            };
        }

        try {
            // Determine if request is to be set as
            // synchronous or asynchronous.
            transaction.c.open(method, u, !sync, config.username || null, config.password || null);
            io._setHeaders(transaction.c, config.headers || {});
            io.start(transaction, config);

            // Will work only in browsers that implement the
            // Cross-Origin Resource Sharing draft.
            if (config.xdr && config.xdr.credentials && SUPPORTS_CORS) {
                transaction.c.withCredentials = true;
            }

            // Using "null" with HTTP POST will result in a request
            // with no Content-Length header defined.
            transaction.c.send(data);

            if (sync) {
                // Create a response object for synchronous transactions,
                // mixing id and arguments properties with the xhr
                // properties whitelist.
                for (i = 0, len = XHR_PROPS.length; i < len; ++i) {
                    response[XHR_PROPS[i]] = transaction.c[XHR_PROPS[i]];
                }

                response.getAllResponseHeaders = function() {
                    return transaction.c.getAllResponseHeaders();
                };

                response.getResponseHeader = function(name) {
                    return transaction.c.getResponseHeader(name);
                };

                io.complete(transaction, config);
                io._result(transaction, config);

                return response;
            }
        } catch(e) {
            if (transaction.xdr) {
                // This exception is usually thrown by browsers
                // that do not support XMLHttpRequest Level 2.
                // Retry the request with the XDR transport set
                // to 'flash'.  If the Flash transport is not
                // initialized or available, the transaction
                // will resolve to a transport error.
                return io._retry(transaction, uri, config);
            } else {
                io.complete(transaction, config);
                io._result(transaction, config);
            }
        }

        // If config.timeout is defined, and the request is standard XHR,
        // initialize timeout polling.
        if (config.timeout) {
            io._startTimeout(transaction, config.timeout);
        }

        return {
            id: transaction.id,
            abort: function() {
                return transaction.c ? io._abort(transaction, 'abort') : false;
            },
            isInProgress: function() {
                return transaction.c ? (transaction.c.readyState % 4) : false;
            },
            io: io
        };
    }
};

/**
Method for initiating an ajax call.  The first argument is the url end
point for the call.  The second argument is an object to configure the
transaction and attach event subscriptions.  The configuration object
supports the following properties:

<dl>
  <dt>method</dt>
    <dd>HTTP method verb (e.g., GET or POST). If this property is not
        not defined, the default value will be GET.</dd>

  <dt>data</dt>
    <dd>This is the name-value string that will be sent as the
    transaction data. If the request is HTTP GET, the data become
    part of querystring. If HTTP POST, the data are sent in the
    message body.</dd>

  <dt>xdr</dt>
    <dd>Defines the transport to be used for cross-domain requests.
    By setting this property, the transaction will use the specified
    transport instead of XMLHttpRequest. The properties of the
    transport object are:
    <dl>
      <dt>use</dt>
        <dd>The transport to be used: 'flash' or 'native'</dd>
      <dt>dataType</dt>
        <dd>Set the value to 'XML' if that is the expected response
        content type.</dd>
    </dl></dd>

  <dt>form</dt>
    <dd>Form serialization configuration object.  Its properties are:
    <dl>
      <dt>id</dt>
        <dd>Node object or id of HTML form</dd>
      <dt>useDisabled</dt>
        <dd>`true` to also serialize disabled form field values
        (defaults to `false`)</dd>
    </dl></dd>

  <dt>on</dt>
    <dd>Assigns transaction event subscriptions. Available events are:
    <dl>
      <dt>start</dt>
        <dd>Fires when a request is sent to a resource.</dd>
      <dt>complete</dt>
        <dd>Fires when the transaction is complete.</dd>
      <dt>success</dt>
        <dd>Fires when the HTTP response status is within the 2xx
        range.</dd>
      <dt>failure</dt>
        <dd>Fires when the HTTP response status is outside the 2xx
        range, if an exception occurs, if the transation is aborted,
        or if the transaction exceeds a configured `timeout`.</dd>
      <dt>end</dt>
        <dd>Fires at the conclusion of the transaction
           lifecycle, after `success` or `failure`.</dd>
    </dl>

    <p>Callback functions for `start` and `end` receive the id of the
    transaction as a first argument. For `complete`, `success`, and
    `failure`, callbacks receive the id and the response object
    (usually the XMLHttpRequest instance).  If the `arguments`
    property was included in the configuration object passed to
    `Y.io()`, the configured data will be passed to all callbacks as
    the last argument.</p>
    </dd>

  <dt>sync</dt>
    <dd>Pass `true` to make a same-domain transaction synchronous.
    <strong>CAVEAT</strong>: This will negatively impact the user
    experience. Have a <em>very</em> good reason if you intend to use
    this.</dd>

  <dt>context</dt>
    <dd>The "`this'" object for all configured event handlers. If a
    specific context is needed for individual callbacks, bind the
    callback to a context using `Y.bind()`.</dd>

  <dt>headers</dt>
    <dd>Object map of transaction headers to send to the server. The
    object keys are the header names and the values are the header
    values.</dd>

  <dt>timeout</dt>
    <dd>Millisecond threshold for the transaction before being
    automatically aborted.</dd>

  <dt>arguments</dt>
    <dd>User-defined data passed to all registered event handlers.
    This value is available as the second argument in the "start" and
    "end" event handlers. It is the third argument in the "complete",
    "success", and "failure" event handlers. <strong>Be sure to quote
    this property name in the transaction configuration as
    "arguments" is a reserved word in JavaScript</strong> (e.g.
    `Y.io({ ..., "arguments": stuff })`).</dd>
</dl>

@method io
@static
@param {String} url qualified path to transaction resource.
@param {Object} config configuration object for the transaction.
@return {Object}
@for YUI
**/
Y.io = function(url, config) {
    // Calling IO through the static interface will use and reuse
    // an instance of IO.
    var transaction = Y.io._map['io:0'] || new IO();
    return transaction.send.apply(transaction, [url, config]);
};

/**
Method for setting and deleting IO HTTP headers to be sent with every
request.

Hosted as a property on the `io` function (e.g. `Y.io.header`).

@method header
@param {String} name HTTP header
@param {String} value HTTP header value
@static
**/
Y.io.header = function(name, value) {
    // Calling IO through the static interface will use and reuse
    // an instance of IO.
    var transaction = Y.io._map['io:0'] || new IO();
    transaction.setHeader(name, value);
};

Y.IO = IO;
// Map of all IO instances created.
Y.io._map = {};
var XHR = win && win.XMLHttpRequest,
    XDR = win && win.XDomainRequest,
    AX = win && win.ActiveXObject,

    // Checks for the presence of the `withCredentials` in an XHR instance
    // object, which will be present if the environment supports CORS.
    SUPPORTS_CORS = XHR && 'withCredentials' in (new XMLHttpRequest());


Y.mix(Y.IO, {
    /**
    * The ID of the default IO transport, defaults to `xhr`
    * @property _default
    * @type {String}
    * @static
    */
    _default: 'xhr',
    /**
    *
    * @method defaultTransport
    * @static
    * @param {String} [id] The transport to set as the default, if empty a new transport is created.
    * @return {Object} The transport object with a `send` method
    */
    defaultTransport: function(id) {
        if (id) {
            Y.IO._default = id;
        } else {
            var o = {
                c: Y.IO.transports[Y.IO._default](),
                notify: Y.IO._default === 'xhr' ? false : true
            };
            return o;
        }
    },
    /**
    * An object hash of custom transports available to IO
    * @property transports
    * @type {Object}
    * @static
    */
    transports: {
        xhr: function () {
            return XHR ? new XMLHttpRequest() :
                AX ? new ActiveXObject('Microsoft.XMLHTTP') : null;
        },
        xdr: function () {
            return XDR ? new XDomainRequest() : null;
        },
        iframe: function () { return {}; },
        flash: null,
        nodejs: null
    },
    /**
    * Create a custom transport of type and return it's object
    * @method customTransport
    * @param {String} id The id of the transport to create.
    * @static
    */
    customTransport: function(id) {
        var o = { c: Y.IO.transports[id]() };

        o[(id === 'xdr' || id === 'flash') ? 'xdr' : 'notify'] = true;
        return o;
    }
});

Y.mix(Y.IO.prototype, {
    /**
    * Fired from the notify method of the transport which in turn fires
    * the event on the IO object.
    * @method notify
    * @param {String} event The name of the event
    * @param {Object} transaction The transaction object
    * @param {Object} config The configuration object for this transaction
    */
    notify: function(event, transaction, config) {
        var io = this;

        switch (event) {
            case 'timeout':
            case 'abort':
            case 'transport error':
                transaction.c = { status: 0, statusText: event };
                event = 'failure';
            default:
                io[event].apply(io, [transaction, config]);
        }
    }
});




}, '3.17.1', {"requires": ["event-custom-base", "querystring-stringify-simple"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('datatype-xml-parse', function (Y, NAME) {

/**
 * Parse XML submodule.
 *
 * @module datatype-xml
 * @submodule datatype-xml-parse
 * @for XML
 */

Y.mix(Y.namespace("XML"), {
    /**
     * Converts data to type XMLDocument.
     *
     * @method parse
     * @param data {String} Data to convert.
     * @return {XMLDocument} XML Document.
     */
    parse: function(data) {
        var xmlDoc = null, win;
        if (typeof data === "string") {
            win = Y.config.win;
            if (win.ActiveXObject !== undefined) {
                xmlDoc = new ActiveXObject("Microsoft.XMLDOM");
                xmlDoc.async = false;
                xmlDoc.loadXML(data);            
            } else if (win.DOMParser !== undefined) {
                xmlDoc = new DOMParser().parseFromString(data, "text/xml");            
            } else if (win.Windows !== undefined) {
                xmlDoc = new Windows.Data.Xml.Dom.XmlDocument();
                xmlDoc.loadXml(data);            
            }
        }

        if (xmlDoc === null || xmlDoc.documentElement === null || xmlDoc.documentElement.nodeName === "parsererror") {
        }

        return xmlDoc;
    }
});

// Add Parsers shortcut
Y.namespace("Parsers").xml = Y.XML.parse;

Y.namespace("DataType");
Y.DataType.XML = Y.XML;


}, '3.17.1');
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('io-xdr', function (Y, NAME) {

/**
Extends IO to provide an alternate, Flash transport, for making
cross-domain requests.
@module io
@submodule io-xdr
@for IO
@deprecated
**/

// Helpful resources when working with the mess that is XDomainRequest:
// http://www.cypressnorth.com/blog/web-programming-and-development/internet-explorer-aborting-ajax-requests-fixed/
// http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx

/**
Fires when the XDR transport is ready for use.
@event io:xdrReady
**/
var E_XDR_READY = Y.publish('io:xdrReady', { fireOnce: true }),

/**
Map of stored configuration objects when using
Flash as the transport for cross-domain requests.

@property _cB
@private
@type {Object}
**/
_cB = {},

/**
Map of transaction simulated readyState values
when XDomainRequest is the transport.

@property _rS
@private
@type {Object}
**/
_rS = {},

// Document reference
d = Y.config.doc,
// Window reference
w = Y.config.win,
// XDomainRequest cross-origin request detection
xdr = w && w.XDomainRequest;

/**
Method that creates the Flash transport swf.

@method _swf
@private
@param {String} uri - location of io.swf.
@param {String} yid - YUI sandbox id.
@param {String} uid - IO instance id.
**/
function _swf(uri, yid, uid) {
    var o = '<object id="io_swf" type="application/x-shockwave-flash" data="' +
            uri + '" width="0" height="0">' +
            '<param name="movie" value="' + uri + '">' +
            '<param name="FlashVars" value="yid=' + yid + '&uid=' + uid + '">' +
            '<param name="allowScriptAccess" value="always">' +
            '</object>',
        c = d.createElement('div');

    d.body.appendChild(c);
    c.innerHTML = o;
}

/**
Creates a response object for XDR transactions, for success
and failure cases.

@method _data
@private
@param {Object} o - Transaction object generated by _create() in io-base.
@param {Boolean} u - Configuration xdr.use.
@param {Boolean} d - Configuration xdr.dataType.

@return {Object}
**/
function _data(o, u, d) {
    if (u === 'flash') {
        o.c.responseText = decodeURI(o.c.responseText);
    }
    if (d === 'xml') {
        o.c.responseXML = Y.DataType.XML.parse(o.c.responseText);
    }

    return o;
}

/**
Method for intiating an XDR transaction abort.

@method _abort
@private
@param {Object} o - Transaction object generated by _create() in io-base.
@param {Object} c - configuration object for the transaction.
**/
function _abort(o, c) {
    return o.c.abort(o.id, c);
}

/**
Method for determining if an XDR transaction has completed
and all data are received.

@method _isInProgress
@private
@param {Object} o - Transaction object generated by _create() in io-base.
**/
function _isInProgress(o) {
    return xdr ? _rS[o.id] !== 4 : o.c.isInProgress(o.id);
}

Y.mix(Y.IO.prototype, {

    /**
    Map of io transports.

    @property _transport
    @private
    @type {Object}
    **/
    _transport: {},

    /**
    Sets event handlers for XDomainRequest transactions.

    @method _ieEvt
    @private
    @static
    @param {Object} o - Transaction object generated by _create() in io-base.
    @param {Object} c - configuration object for the transaction.
    **/
    _ieEvt: function(o, c) {
        var io = this,
            i = o.id,
            t = 'timeout';

        o.c.onprogress = function() { _rS[i] = 3; };
        o.c.onload = function() {
            _rS[i] = 4;
            io.xdrResponse('success', o, c);
        };
        o.c.onerror = function() {
            _rS[i] = 4;
            io.xdrResponse('failure', o, c);
        };
        o.c.ontimeout = function() {
            _rS[i] = 4;
            io.xdrResponse(t, o, c);
        };
        o.c[t] = c[t] || 0;
    },

    /**
    Method for accessing the transport's interface for making a
    cross-domain transaction.

    @method xdr
    @param {String} uri - qualified path to transaction resource.
    @param {Object} o - Transaction object generated by _create() in io-base.
    @param {Object} c - configuration object for the transaction.
    **/
    xdr: function(uri, o, c) {
        var io = this;

        if (c.xdr.use === 'flash') {
            // The configuration object cannot be serialized safely
            // across Flash's ExternalInterface.
            _cB[o.id] = c;
            w.setTimeout(function() {
                try {
                    o.c.send(uri, { id: o.id,
                                    uid: o.uid,
                                    method: c.method,
                                    data: c.data,
                                    headers: c.headers });
                }
                catch(e) {
                    io.xdrResponse('transport error', o, c);
                    delete _cB[o.id];
                }
            }, Y.io.xdr.delay);
        }
        else if (xdr) {
            io._ieEvt(o, c);
            o.c.open(c.method || 'GET', uri);

            // Make async to protect against IE 8 oddities.
            setTimeout(function() {
                o.c.send(c.data);
            }, 0);
        }
        else {
            o.c.send(uri, o, c);
        }

        return {
            id: o.id,
            abort: function() {
                return o.c ? _abort(o, c) : false;
            },
            isInProgress: function() {
                return o.c ? _isInProgress(o.id) : false;
            },
            io: io
        };
    },

    /**
    Response controller for cross-domain requests when using the
    Flash transport or IE8's XDomainRequest object.

    @method xdrResponse
    @param {String} e Event name
    @param {Object} o Transaction object generated by _create() in io-base.
    @param {Object} c Configuration object for the transaction.
    @return {Object}
    **/
    xdrResponse: function(e, o, c) {
        c = _cB[o.id] ? _cB[o.id] : c;
        var io = this,
            m = xdr ? _rS : _cB,
            u = c.xdr.use,
            d = c.xdr.dataType;

        switch (e) {
            case 'start':
                io.start(o, c);
                break;
           //case 'complete':
                //This case is not used by Flash or XDomainRequest.
                //io.complete(o, c);
                //break;
            case 'success':
                io.success(_data(o, u, d), c);
                delete m[o.id];
                break;
            case 'timeout':
            case 'abort':
            case 'transport error':
                o.c = { status: 0, statusText: e };
            case 'failure':
                io.failure(_data(o, u, d), c);
                delete m[o.id];
                break;
        }
    },

    /**
    Fires event "io:xdrReady"

    @method _xdrReady
    @private
    @param {Number} yid - YUI sandbox id.
    @param {Number} uid - IO instance id.
    **/
    _xdrReady: function(yid, uid) {
        Y.fire(E_XDR_READY, yid, uid);
    },

    /**
    Initializes the desired transport.

    @method transport
    @param {Object} o - object of transport configurations.
    **/
    transport: function(c) {
        if (c.id === 'flash') {
            _swf(Y.UA.ie ? c.src + '?d=' + new Date().valueOf().toString() : c.src, Y.id, c.uid);
            Y.IO.transports.flash = function() { return d.getElementById('io_swf'); };
        }
    }
});

/**
Fires event "io:xdrReady"

@method xdrReady
@protected
@static
@param {Number} yid - YUI sandbox id.
@param {Number} uid - IO instance id.
**/
Y.io.xdrReady = function(yid, uid){
    var io = Y.io._map[uid];
    Y.io.xdr.delay = 0;
    io._xdrReady.apply(io, [yid, uid]);
};

Y.io.xdrResponse = function(e, o, c){
    var io = Y.io._map[o.uid];
    io.xdrResponse.apply(io, [e, o, c]);
};

Y.io.transport = function(c){
    var io = Y.io._map['io:0'] || new Y.IO();
    c.uid = io._uid;
    io.transport.apply(io, [c]);
};

/**
Delay value to calling the Flash transport, in the
event io.swf has not finished loading.  Once the E_XDR_READY
event is fired, this value will be set to 0.

@property delay
@static
@type {Number}
**/
Y.io.xdr = { delay : 100 };


}, '3.17.1', {"requires": ["io-base", "datatype-xml-parse"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('io-xdr', function (Y, NAME) {

/**
Extends IO to provide an alternate, Flash transport, for making
cross-domain requests.
@module io
@submodule io-xdr
@for IO
@deprecated
**/

// Helpful resources when working with the mess that is XDomainRequest:
// http://www.cypressnorth.com/blog/web-programming-and-development/internet-explorer-aborting-ajax-requests-fixed/
// http://blogs.msdn.com/b/ieinternals/archive/2010/05/13/xdomainrequest-restrictions-limitations-and-workarounds.aspx

/**
Fires when the XDR transport is ready for use.
@event io:xdrReady
**/
var E_XDR_READY = Y.publish('io:xdrReady', { fireOnce: true }),

/**
Map of stored configuration objects when using
Flash as the transport for cross-domain requests.

@property _cB
@private
@type {Object}
**/
_cB = {},

/**
Map of transaction simulated readyState values
when XDomainRequest is the transport.

@property _rS
@private
@type {Object}
**/
_rS = {},

// Document reference
d = Y.config.doc,
// Window reference
w = Y.config.win,
// XDomainRequest cross-origin request detection
xdr = w && w.XDomainRequest;

/**
Method that creates the Flash transport swf.

@method _swf
@private
@param {String} uri - location of io.swf.
@param {String} yid - YUI sandbox id.
@param {String} uid - IO instance id.
**/
function _swf(uri, yid, uid) {
    var o = '<object id="io_swf" type="application/x-shockwave-flash" data="' +
            uri + '" width="0" height="0">' +
            '<param name="movie" value="' + uri + '">' +
            '<param name="FlashVars" value="yid=' + yid + '&uid=' + uid + '">' +
            '<param name="allowScriptAccess" value="always">' +
            '</object>',
        c = d.createElement('div');

    d.body.appendChild(c);
    c.innerHTML = o;
}

/**
Creates a response object for XDR transactions, for success
and failure cases.

@method _data
@private
@param {Object} o - Transaction object generated by _create() in io-base.
@param {Boolean} u - Configuration xdr.use.
@param {Boolean} d - Configuration xdr.dataType.

@return {Object}
**/
function _data(o, u, d) {
    if (u === 'flash') {
        o.c.responseText = decodeURI(o.c.responseText);
    }
    if (d === 'xml') {
        o.c.responseXML = Y.DataType.XML.parse(o.c.responseText);
    }

    return o;
}

/**
Method for intiating an XDR transaction abort.

@method _abort
@private
@param {Object} o - Transaction object generated by _create() in io-base.
@param {Object} c - configuration object for the transaction.
**/
function _abort(o, c) {
    return o.c.abort(o.id, c);
}

/**
Method for determining if an XDR transaction has completed
and all data are received.

@method _isInProgress
@private
@param {Object} o - Transaction object generated by _create() in io-base.
**/
function _isInProgress(o) {
    return xdr ? _rS[o.id] !== 4 : o.c.isInProgress(o.id);
}

Y.mix(Y.IO.prototype, {

    /**
    Map of io transports.

    @property _transport
    @private
    @type {Object}
    **/
    _transport: {},

    /**
    Sets event handlers for XDomainRequest transactions.

    @method _ieEvt
    @private
    @static
    @param {Object} o - Transaction object generated by _create() in io-base.
    @param {Object} c - configuration object for the transaction.
    **/
    _ieEvt: function(o, c) {
        var io = this,
            i = o.id,
            t = 'timeout';

        o.c.onprogress = function() { _rS[i] = 3; };
        o.c.onload = function() {
            _rS[i] = 4;
            io.xdrResponse('success', o, c);
        };
        o.c.onerror = function() {
            _rS[i] = 4;
            io.xdrResponse('failure', o, c);
        };
        o.c.ontimeout = function() {
            _rS[i] = 4;
            io.xdrResponse(t, o, c);
        };
        o.c[t] = c[t] || 0;
    },

    /**
    Method for accessing the transport's interface for making a
    cross-domain transaction.

    @method xdr
    @param {String} uri - qualified path to transaction resource.
    @param {Object} o - Transaction object generated by _create() in io-base.
    @param {Object} c - configuration object for the transaction.
    **/
    xdr: function(uri, o, c) {
        var io = this;

        if (c.xdr.use === 'flash') {
            // The configuration object cannot be serialized safely
            // across Flash's ExternalInterface.
            _cB[o.id] = c;
            w.setTimeout(function() {
                try {
                    o.c.send(uri, { id: o.id,
                                    uid: o.uid,
                                    method: c.method,
                                    data: c.data,
                                    headers: c.headers });
                }
                catch(e) {
                    io.xdrResponse('transport error', o, c);
                    delete _cB[o.id];
                }
            }, Y.io.xdr.delay);
        }
        else if (xdr) {
            io._ieEvt(o, c);
            o.c.open(c.method || 'GET', uri);

            // Make async to protect against IE 8 oddities.
            setTimeout(function() {
                o.c.send(c.data);
            }, 0);
        }
        else {
            o.c.send(uri, o, c);
        }

        return {
            id: o.id,
            abort: function() {
                return o.c ? _abort(o, c) : false;
            },
            isInProgress: function() {
                return o.c ? _isInProgress(o.id) : false;
            },
            io: io
        };
    },

    /**
    Response controller for cross-domain requests when using the
    Flash transport or IE8's XDomainRequest object.

    @method xdrResponse
    @param {String} e Event name
    @param {Object} o Transaction object generated by _create() in io-base.
    @param {Object} c Configuration object for the transaction.
    @return {Object}
    **/
    xdrResponse: function(e, o, c) {
        c = _cB[o.id] ? _cB[o.id] : c;
        var io = this,
            m = xdr ? _rS : _cB,
            u = c.xdr.use,
            d = c.xdr.dataType;

        switch (e) {
            case 'start':
                io.start(o, c);
                break;
           //case 'complete':
                //This case is not used by Flash or XDomainRequest.
                //io.complete(o, c);
                //break;
            case 'success':
                io.success(_data(o, u, d), c);
                delete m[o.id];
                break;
            case 'timeout':
            case 'abort':
            case 'transport error':
                o.c = { status: 0, statusText: e };
            case 'failure':
                io.failure(_data(o, u, d), c);
                delete m[o.id];
                break;
        }
    },

    /**
    Fires event "io:xdrReady"

    @method _xdrReady
    @private
    @param {Number} yid - YUI sandbox id.
    @param {Number} uid - IO instance id.
    **/
    _xdrReady: function(yid, uid) {
        Y.fire(E_XDR_READY, yid, uid);
    },

    /**
    Initializes the desired transport.

    @method transport
    @param {Object} o - object of transport configurations.
    **/
    transport: function(c) {
        if (c.id === 'flash') {
            _swf(Y.UA.ie ? c.src + '?d=' + new Date().valueOf().toString() : c.src, Y.id, c.uid);
            Y.IO.transports.flash = function() { return d.getElementById('io_swf'); };
        }
    }
});

/**
Fires event "io:xdrReady"

@method xdrReady
@protected
@static
@param {Number} yid - YUI sandbox id.
@param {Number} uid - IO instance id.
**/
Y.io.xdrReady = function(yid, uid){
    var io = Y.io._map[uid];
    Y.io.xdr.delay = 0;
    io._xdrReady.apply(io, [yid, uid]);
};

Y.io.xdrResponse = function(e, o, c){
    var io = Y.io._map[o.uid];
    io.xdrResponse.apply(io, [e, o, c]);
};

Y.io.transport = function(c){
    var io = Y.io._map['io:0'] || new Y.IO();
    c.uid = io._uid;
    io.transport.apply(io, [c]);
};

/**
Delay value to calling the Flash transport, in the
event io.swf has not finished loading.  Once the E_XDR_READY
event is fired, this value will be set to 0.

@property delay
@static
@type {Number}
**/
Y.io.xdr = { delay : 100 };


}, '3.17.1', {"requires": ["io-base", "datatype-xml-parse"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('io-form', function (Y, NAME) {

/**
* Extends IO to enable HTML form data serialization, when specified
* in the transaction's configuration object.
* @module io
* @submodule io-form
* @for IO
*/

var eUC = encodeURIComponent;

/**
 * Enumerate through an HTML form's elements collection
 * and return a string comprised of key-value pairs.
 *
 * @method stringify
 * @static
 * @param {Node|String} form YUI form node or HTML form id
 * @param {Object} [options] Configuration options.
 * @param {Boolean} [options.useDisabled=false] Whether to include disabled fields.
 * @param {Object|String} [options.extra] Extra values to include. May be a query string or an object with key/value pairs.
 * @return {String}
 */
Y.IO.stringify = function(form, options) {
    options = options || {};

    var s = Y.IO.prototype._serialize({
        id: form,
        useDisabled: options.useDisabled
    },
    options.extra && typeof options.extra === 'object' ? Y.QueryString.stringify(options.extra) : options.extra);

    return s;
};

Y.mix(Y.IO.prototype, {
   /**
    * Enumerate through an HTML form's elements collection
    * and return a string comprised of key-value pairs.
    *
    * @method _serialize
    * @private
    * @param {Object} c
    * @param {String|Element} c.id YUI form node or HTML form id
    * @param {Boolean} c.useDisabled `true` to include disabled fields
    * @param {String} s Key-value data defined in the configuration object.
    * @return {String}
    */
    _serialize: function(c, s) {
        var data = [],
            df = c.useDisabled || false,
            item = 0,
            id = (typeof c.id === 'string') ? c.id : c.id.getAttribute('id'),
            e, f, n, v, d, i, il, j, jl, o;

        if (!id) {
            id = Y.guid('io:');
            c.id.setAttribute('id', id);
        }

        f = Y.config.doc.getElementById(id);

        if (!f || !f.elements) {
            return s || '';
        }

        // Iterate over the form elements collection to construct the
        // label-value pairs.
        for (i = 0, il = f.elements.length; i < il; ++i) {
            e = f.elements[i];
            d = e.disabled;
            n = e.name;

            if (df ? n : n && !d) {
                n = eUC(n) + '=';
                v = eUC(e.value);

                switch (e.type) {
                    // Safari, Opera, FF all default options.value from .text if
                    // value attribute not specified in markup
                    case 'select-one':
                        if (e.selectedIndex > -1) {
                            o = e.options[e.selectedIndex];
                            data[item++] = n + eUC(o.attributes.value && o.attributes.value.specified ? o.value : o.text);
                        }
                        break;
                    case 'select-multiple':
                        if (e.selectedIndex > -1) {
                            for (j = e.selectedIndex, jl = e.options.length; j < jl; ++j) {
                                o = e.options[j];
                                if (o.selected) {
                                  data[item++] = n + eUC(o.attributes.value && o.attributes.value.specified ? o.value : o.text);
                                }
                            }
                        }
                        break;
                    case 'radio':
                    case 'checkbox':
                        if (e.checked) {
                            data[item++] = n + v;
                        }
                        break;
                    case 'file':
                        // stub case as XMLHttpRequest will only send the file path as a string.
                    case undefined:
                        // stub case for fieldset element which returns undefined.
                    case 'reset':
                        // stub case for input type reset button.
                    case 'button':
                        // stub case for input type button elements.
                        break;
                    case 'submit':
                    default:
                        data[item++] = n + v;
                }
            }
        }

        if (s) {
            data[item++] = s;
        }

        return data.join('&');
    }
}, true);


}, '3.17.1', {"requires": ["io-base", "node-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('io-upload-iframe', function (Y, NAME) {

/**
Extends the IO  to enable file uploads, with HTML forms
using an iframe as the transport medium.
@module io
@submodule io-upload-iframe
@for IO
**/

var w = Y.config.win,
    d = Y.config.doc,
    _std = (d.documentMode && d.documentMode >= 8),
    _d = decodeURIComponent,
    _end = Y.IO.prototype.end;

/**
 * Creates the iframe transported used in file upload
 * transactions, and binds the response event handler.
 *
 * @method _cFrame
 * @private
 * @param {Object} o Transaction object generated by _create().
 * @param {Object} c Configuration object passed to YUI.io().
 * @param {Object} io
 */
function _cFrame(o, c, io) {
    var i = Y.Node.create('<iframe id="io_iframe' + o.id + '" name="io_iframe' + o.id + '" />');
        i._node.style.position = 'absolute';
        i._node.style.top = '-1000px';
        i._node.style.left = '-1000px';
        Y.one('body').appendChild(i);
    // Bind the onload handler to the iframe to detect the file upload response.
    Y.on("load", function() { io._uploadComplete(o, c); }, '#io_iframe' + o.id);
}

/**
 * Removes the iframe transport used in the file upload
 * transaction.
 *
 * @method _dFrame
 * @private
 * @param {Number} id The transaction ID used in the iframe's creation.
 */
function _dFrame(id) {
	Y.Event.purgeElement('#io_iframe' + id, false);
	Y.one('body').removeChild(Y.one('#io_iframe' + id));
}

Y.mix(Y.IO.prototype, {
   /**
    * Parses the POST data object and creates hidden form elements
    * for each key-value, and appends them to the HTML form object.
    * @method _addData
    * @private
    * @static
    * @param {Object} f HTML form object.
    * @param {String} s The key-value POST data.
    * @return {Array} o Array of created fields.
    */
    _addData: function(f, s) {
        // Serialize an object into a key-value string using
        // querystring-stringify-simple.
        if (Y.Lang.isObject(s)) {
            s = Y.QueryString.stringify(s);
        }

        var o = [],
            m = s.split('='),
            i, l;

        for (i = 0, l = m.length - 1; i < l; i++) {
            o[i] = d.createElement('input');
            o[i].type = 'hidden';
            o[i].name = _d(m[i].substring(m[i].lastIndexOf('&') + 1));
            o[i].value = (i + 1 === l) ? _d(m[i + 1]) : _d(m[i + 1].substring(0, (m[i + 1].lastIndexOf('&'))));
            f.appendChild(o[i]);
        }

        return o;
    },

   /**
    * Removes the custom fields created to pass additional POST
    * data, along with the HTML form fields.
    * @method _removeData
    * @private
    * @static
    * @param {Object} f HTML form object.
    * @param {Object} o HTML form fields created from configuration.data.
    */
    _removeData: function(f, o) {
        var i, l;

        for (i = 0, l = o.length; i < l; i++) {
            f.removeChild(o[i]);
        }
    },

   /**
    * Sets the appropriate attributes and values to the HTML
    * form, in preparation of a file upload transaction.
    * @method _setAttrs
    * @private
    * @static
    * @param {Object} f HTML form object.
    * @param {Object} id The Transaction ID.
    * @param {Object} uri Qualified path to transaction resource.
    */
    _setAttrs: function(f, id, uri) {
        // Track original HTML form attribute values.
        this._originalFormAttrs = {
            action: f.getAttribute('action'),
            target: f.getAttribute('target')
        };

        f.setAttribute('action', uri);
        f.setAttribute('method', 'POST');
        f.setAttribute('target', 'io_iframe' + id );
        f.setAttribute(Y.UA.ie && !_std ? 'encoding' : 'enctype', 'multipart/form-data');
    },

   /**
    * Reset the HTML form attributes to their original values.
    * @method _resetAttrs
    * @private
    * @static
    * @param {Object} f HTML form object.
    * @param {Object} a Object of original attributes.
    */
    _resetAttrs: function(f, a) {
        Y.Object.each(a, function(v, p) {
            if (v) {
                f.setAttribute(p, v);
            }
            else {
                f.removeAttribute(p);
            }
        });
    },

   /**
    * Starts timeout count if the configuration object
    * has a defined timeout property.
    *
    * @method _startUploadTimeout
    * @private
    * @static
    * @param {Object} o Transaction object generated by _create().
    * @param {Object} c Configuration object passed to YUI.io().
    */
    _startUploadTimeout: function(o, c) {
        var io = this;

        io._timeout[o.id] = w.setTimeout(
            function() {
                o.status = 0;
                o.statusText = 'timeout';
                io.complete(o, c);
                io.end(o, c);
            }, c.timeout);
    },

   /**
    * Clears the timeout interval started by _startUploadTimeout().
    * @method _clearUploadTimeout
    * @private
    * @static
    * @param {Number} id - Transaction ID.
    */
    _clearUploadTimeout: function(id) {
        var io = this;

        w.clearTimeout(io._timeout[id]);
        delete io._timeout[id];
    },

   /**
    * Bound to the iframe's Load event and processes
    * the response data.
    * @method _uploadComplete
    * @private
    * @static
    * @param {Object} o The transaction object
    * @param {Object} c Configuration object for the transaction.
    */
    _uploadComplete: function(o, c) {
        var io = this,
            d = Y.one('#io_iframe' + o.id).get('contentWindow.document'),
            b = d.one('body'),
            p;

        if (c.timeout) {
            io._clearUploadTimeout(o.id);
        }

		try {
			if (b) {
				// When a response Content-Type of "text/plain" is used, Firefox and Safari
				// will wrap the response string with <pre></pre>.
				p = b.one('pre:first-child');
				o.c.responseText = p ? p.get('text') : b.get('text');
			}
			else {
				o.c.responseXML = d._node;
			}
		}
		catch (e) {
			o.e = "upload failure";
		}

        io.complete(o, c);
        io.end(o, c);
        // The transaction is complete, so call _dFrame to remove
        // the event listener bound to the iframe transport, and then
        // destroy the iframe.
        w.setTimeout( function() { _dFrame(o.id); }, 0);
    },

   /**
    * Uploads HTML form data, inclusive of files/attachments,
    * using the iframe created in _create to facilitate the transaction.
    * @method _upload
    * @private
    * @static
    * @param {Object} o The transaction object
    * @param {Object} uri Qualified path to transaction resource.
    * @param {Object} c Configuration object for the transaction.
    */
    _upload: function(o, uri, c) {
        var io = this,
            f = (typeof c.form.id === 'string') ? d.getElementById(c.form.id) : c.form.id,
            fields;

        // Initialize the HTML form properties in case they are
        // not defined in the HTML form.
        io._setAttrs(f, o.id, uri);
        if (c.data) {
            fields = io._addData(f, c.data);
        }

        // Start polling if a callback is present and the timeout
        // property has been defined.
        if (c.timeout) {
            io._startUploadTimeout(o, c);
        }

        // Start file upload.
        f.submit();
        io.start(o, c);
        if (c.data) {
            io._removeData(f, fields);
        }

        return {
            id: o.id,
            abort: function() {
                o.status = 0;
                o.statusText = 'abort';
                if (Y.one('#io_iframe' + o.id)) {
                    _dFrame(o.id);
                    io.complete(o, c);
                    io.end(o, c);
                }
                else {
                    return false;
                }
            },
            isInProgress: function() {
                return Y.one('#io_iframe' + o.id) ? true : false;
            },
            io: io
        };
    },

    upload: function(o, uri, c) {
        _cFrame(o, c, this);
        return this._upload(o, uri, c);
    },

    end: function(transaction, config) {
        var form, io;

        if (config) {
            form = config.form;

            if (form && form.upload) {
                io = this;

                // Restore HTML form attributes to their original values.
                form = (typeof form.id === 'string') ? d.getElementById(form.id) : form.id;

                // Check whether the form still exists before resetting it.
                if (form) {
                    io._resetAttrs(form, this._originalFormAttrs);
                }
            }
        }

        return _end.call(this, transaction, config);
    }
}, true);


}, '3.17.1', {"requires": ["io-base", "node-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('queue-promote', function (Y, NAME) {

/**
 * Adds methods promote, remove, and indexOf to Queue instances.
 *
 * @module queue-promote
 * @for Queue
 */

Y.mix(Y.Queue.prototype, {
    /**
     * Returns the current index in the queue of the specified item
     *
     * @method indexOf
     * @param needle {MIXED} the item to search for
     * @return {Number} the index of the item or -1 if not found
     */
    indexOf : function (callback) {
        return Y.Array.indexOf(this._q, callback);
    },

    /**
     * Moves the referenced item to the head of the queue
     *
     * @method promote
     * @param item {MIXED} an item in the queue
     */
    promote : function (callback) {
        var index = this.indexOf(callback);

        if (index > -1) {
            this._q.unshift(this._q.splice(index,1)[0]);
        }
    },

    /**
     * Removes the referenced item from the queue
     *
     * @method remove
     * @param item {MIXED} an item in the queue
     */
    remove : function (callback) {
        var index = this.indexOf(callback);

        if (index > -1) {
            this._q.splice(index,1);
        }
    }

});


}, '3.17.1', {"requires": ["yui-base"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('io-queue', function (Y, NAME) {

/**
Extends IO to implement Queue for synchronous
transaction processing.
@module io
@submodule io-queue
@for IO
**/
var io = Y.io._map['io:0'] || new Y.IO();

Y.mix(Y.IO.prototype, {
   /**
    * Array of transactions queued for processing
    *
    * @property _q
    * @private
    * @static
    * @type {Object}
    */
    _q: new Y.Queue(),
    _qActiveId: null,
    _qInit: false,

   /**
    * Property to determine whether the queue is set to
    * 1 (active) or 0 (inactive).  When inactive, transactions
    * will be stored in the queue until the queue is set to active.
    *
    * @property _qState
    * @private
    * @static
    * @type {Number}
    */
    _qState: 1,

   /**
    * Method Process the first transaction from the
    * queue in FIFO order.
    *
    * @method _qShift
    * @private
    * @static
    */
    _qShift: function() {
        var io = this,
            o = io._q.next();

        io._qActiveId = o.id;
        io._qState = 0;
        io.send(o.uri, o.cfg, o.id);
    },

   /**
    * Method for queueing a transaction before the request is sent to the
    * resource, to ensure sequential processing.
    *
    * @method queue
    * @static
    * @return {Object}
    */
    queue: function(uri, c) {
        var io = this,
            o = { uri: uri, cfg:c, id: this._id++ };

        if(!io._qInit) {
            Y.on('io:complete', function(id, o) { io._qNext(id); }, io);
            io._qInit = true;
        }

        io._q.add(o);
        if (io._qState === 1) {
            io._qShift();
        }

        return o;
    },

    _qNext: function(id) {
        var io = this;
        io._qState = 1;
        if (io._qActiveId === id && io._q.size() > 0) {
            io._qShift();
        }
    },

   /**
    * Method for promoting a transaction to the top of the queue.
    *
    * @method promote
    * @static
    */
    qPromote: function(o) {
        this._q.promote(o);
    },

   /**
    * Method for removing a specific, pending transaction from
    * the queue.
    *
    * @method remove
    * @private
    * @static
    */
    qRemove: function(o) {
        this._q.remove(o);
    },

   /**
    * Method for cancel all pending transaction from
    * the queue.
    *
    * @method empty
    * @static
    * @since 3.7.3
    */
    qEmpty: function() {
        this._q = new Y.Queue();
    },

    qStart: function() {
        var io = this;
        io._qState = 1;

        if (io._q.size() > 0) {
            io._qShift();
        }
    },

   /**
    * Method for setting queue processing to inactive.
    * Transaction requests to YUI.io.queue() will be stored in the queue, but
    * not processed until the queue is reset to "active".
    *
    * @method _stop
    * @private
    * @static
    */
    qStop: function() {
        this._qState = 0;
    },

   /**
    * Method to query the current size of the queue.
    *
    * @method _size
    * @private
    * @static
    * @return {Number}
    */
    qSize: function() {
        return this._q.size();
    }

}, true);

function _queue(u, c) {
    return io.queue.apply(io, [u, c]);
}

_queue.start = function () { io.qStart(); };
_queue.stop = function () { io.qStop(); };
_queue.promote = function (o) { io.qPromote(o); };
_queue.remove = function (o) { io.qRemove(o); };
_queue.size = function () { io.qSize(); };
_queue.empty = function () { io.qEmpty(); };
Y.io.queue = _queue;


}, '3.17.1', {"requires": ["io-base", "queue-promote"]});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('overlay', function (Y, NAME) {

/**
 * Provides a basic Overlay widget, with Standard Module content support. The Overlay widget
 * provides Page XY positioning support, alignment and centering support along with basic
 * stackable support (z-index and shimming).
 *
 * @module overlay
 */

/**
 * A basic Overlay Widget, which can be positioned based on Page XY co-ordinates and is stackable (z-index support).
 * It also provides alignment and centering support and uses a standard module format for it's content, with header,
 * body and footer section support.
 *
 * @class Overlay
 * @constructor
 * @extends Widget
 * @uses WidgetStdMod
 * @uses WidgetPosition
 * @uses WidgetStack
 * @uses WidgetPositionAlign
 * @uses WidgetPositionConstrain
 * @param {Object} object The user configuration for the instance.
 */
Y.Overlay = Y.Base.create("overlay", Y.Widget, [Y.WidgetStdMod, Y.WidgetPosition, Y.WidgetStack, Y.WidgetPositionAlign, Y.WidgetPositionConstrain]);


}, '3.17.1', {
    "requires": [
        "widget",
        "widget-stdmod",
        "widget-position",
        "widget-position-align",
        "widget-stack",
        "widget-position-constrain"
    ],
    "skinnable": true
});
/*
YUI 3.17.1 (build 0eb5a52)
Copyright 2014 Yahoo! Inc. All rights reserved.
Licensed under the BSD License.
http://yuilibrary.com/license/
*/

YUI.add('transition', function (Y, NAME) {

/**
* Provides the transition method for Node.
* Transition has no API of its own, but adds the transition method to Node.
*
* @module transition
* @requires node-style
*/

var CAMEL_VENDOR_PREFIX = '',
    VENDOR_PREFIX = '',
    DOCUMENT = Y.config.doc,
    DOCUMENT_ELEMENT = 'documentElement',
    DOCUMENT_STYLE = DOCUMENT[DOCUMENT_ELEMENT].style,
    TRANSITION_CAMEL = 'transition',
    TRANSITION_PROPERTY_CAMEL = 'transitionProperty',
    TRANSITION_PROPERTY,
    TRANSITION_DURATION,
    TRANSITION_TIMING_FUNCTION,
    TRANSITION_DELAY,
    TRANSITION_END,
    ON_TRANSITION_END,

    EMPTY_OBJ = {},

    VENDORS = [
        'Webkit',
        'Moz'
    ],

    VENDOR_TRANSITION_END = {
        Webkit: 'webkitTransitionEnd'
    },

/**
 * A class for constructing transition instances.
 * Adds the "transition" method to Node.
 * @class Transition
 * @constructor
 */

Transition = function() {
    this.init.apply(this, arguments);
};

// One off handling of transform-prefixing.
Transition._TRANSFORM = 'transform';

Transition._toCamel = function(property) {
    property = property.replace(/-([a-z])/gi, function(m0, m1) {
        return m1.toUpperCase();
    });

    return property;
};

Transition._toHyphen = function(property) {
    property = property.replace(/([A-Z]?)([a-z]+)([A-Z]?)/g, function(m0, m1, m2, m3) {
        var str = ((m1) ? '-' + m1.toLowerCase() : '') + m2;

        if (m3) {
            str += '-' + m3.toLowerCase();
        }

        return str;
    });

    return property;
};

Transition.SHOW_TRANSITION = 'fadeIn';
Transition.HIDE_TRANSITION = 'fadeOut';

Transition.useNative = false;

// Map transition properties to vendor-specific versions.
if ('transition' in DOCUMENT_STYLE
    && 'transitionProperty' in DOCUMENT_STYLE
    && 'transitionDuration' in DOCUMENT_STYLE
    && 'transitionTimingFunction' in DOCUMENT_STYLE
    && 'transitionDelay' in DOCUMENT_STYLE) {
    Transition.useNative = true;
    Transition.supported = true; // TODO: remove
} else {
    Y.Array.each(VENDORS, function(val) { // then vendor specific
        var property = val + 'Transition';
        if (property in DOCUMENT[DOCUMENT_ELEMENT].style) {
            CAMEL_VENDOR_PREFIX = val;
            VENDOR_PREFIX       = Transition._toHyphen(val) + '-';

            Transition.useNative = true;
            Transition.supported = true; // TODO: remove
            Transition._VENDOR_PREFIX = val;
        }
    });
}

// Map transform property to vendor-specific versions.
// One-off required for cssText injection.
if (typeof DOCUMENT_STYLE.transform === 'undefined') {
    Y.Array.each(VENDORS, function(val) { // then vendor specific
        var property = val + 'Transform';
        if (typeof DOCUMENT_STYLE[property] !== 'undefined') {
            Transition._TRANSFORM = property;
        }
    });
}

if (CAMEL_VENDOR_PREFIX) {
    TRANSITION_CAMEL          = CAMEL_VENDOR_PREFIX + 'Transition';
    TRANSITION_PROPERTY_CAMEL = CAMEL_VENDOR_PREFIX + 'TransitionProperty';
}

TRANSITION_PROPERTY        = VENDOR_PREFIX + 'transition-property';
TRANSITION_DURATION        = VENDOR_PREFIX + 'transition-duration';
TRANSITION_TIMING_FUNCTION = VENDOR_PREFIX + 'transition-timing-function';
TRANSITION_DELAY           = VENDOR_PREFIX + 'transition-delay';

TRANSITION_END    = 'transitionend';
ON_TRANSITION_END = 'on' + CAMEL_VENDOR_PREFIX.toLowerCase() + 'transitionend';
TRANSITION_END    = VENDOR_TRANSITION_END[CAMEL_VENDOR_PREFIX] || TRANSITION_END;

Transition.fx = {};
Transition.toggles = {};

Transition._hasEnd = {};

Transition._reKeywords = /^(?:node|duration|iterations|easing|delay|on|onstart|onend)$/i;

Y.Node.DOM_EVENTS[TRANSITION_END] = 1;

Transition.NAME = 'transition';

Transition.DEFAULT_EASING = 'ease';
Transition.DEFAULT_DURATION = 0.5;
Transition.DEFAULT_DELAY = 0;

Transition._nodeAttrs = {};

Transition.prototype = {
    constructor: Transition,
    init: function(node, config) {
        var anim = this;
        anim._node = node;
        if (!anim._running && config) {
            anim._config = config;
            node._transition = anim; // cache for reuse

            anim._duration = ('duration' in config) ?
                config.duration: anim.constructor.DEFAULT_DURATION;

            anim._delay = ('delay' in config) ?
                config.delay: anim.constructor.DEFAULT_DELAY;

            anim._easing = config.easing || anim.constructor.DEFAULT_EASING;
            anim._count = 0; // track number of animated properties
            anim._running = false;

        }

        return anim;
    },

    addProperty: function(prop, config) {
        var anim = this,
            node = this._node,
            uid = Y.stamp(node),
            nodeInstance = Y.one(node),
            attrs = Transition._nodeAttrs[uid],
            computed,
            compareVal,
            dur,
            attr,
            val;

        if (!attrs) {
            attrs = Transition._nodeAttrs[uid] = {};
        }

        attr = attrs[prop];

        // might just be a value
        if (config && config.value !== undefined) {
            val = config.value;
        } else if (config !== undefined) {
            val = config;
            config = EMPTY_OBJ;
        }

        if (typeof val === 'function') {
            val = val.call(nodeInstance, nodeInstance);
        }

        if (attr && attr.transition) {
            // take control if another transition owns this property
            if (attr.transition !== anim) {
                attr.transition._count--; // remapping attr to this transition
            }
        }

        anim._count++; // properties per transition

        // make 0 async and fire events
        dur = ((typeof config.duration !== 'undefined') ? config.duration :
                    anim._duration) || 0.0001;

        attrs[prop] = {
            value: val,
            duration: dur,
            delay: (typeof config.delay !== 'undefined') ? config.delay :
                    anim._delay,

            easing: config.easing || anim._easing,

            transition: anim
        };

        // native end event doesnt fire when setting to same value
        // supplementing with timer
        // val may be a string or number (height: 0, etc), but computedStyle is always string
        computed = Y.DOM.getComputedStyle(node, prop);
        compareVal = (typeof val === 'string') ? computed : parseFloat(computed);

        if (Transition.useNative && compareVal === val) {
            setTimeout(function() {
                anim._onNativeEnd.call(node, {
                    propertyName: prop,
                    elapsedTime: dur
                });
            }, dur * 1000);
        }
    },

    removeProperty: function(prop) {
        var anim = this,
            attrs = Transition._nodeAttrs[Y.stamp(anim._node)];

        if (attrs && attrs[prop]) {
            delete attrs[prop];
            anim._count--;
        }

    },

    initAttrs: function(config) {
        var attr,
            node = this._node;

        if (config.transform && !config[Transition._TRANSFORM]) {
            config[Transition._TRANSFORM] = config.transform;
            delete config.transform; // TODO: copy
        }

        for (attr in config) {
            if (config.hasOwnProperty(attr) && !Transition._reKeywords.test(attr)) {
                this.addProperty(attr, config[attr]);

                // when size is auto or % webkit starts from zero instead of computed
                // (https://bugs.webkit.org/show_bug.cgi?id=16020)
                // TODO: selective set
                if (node.style[attr] === '') {
                    Y.DOM.setStyle(node, attr, Y.DOM.getComputedStyle(node, attr));
                }
            }
        }
    },

    /**
     * Starts or an animation.
     * @method run
     * @chainable
     * @private
     */
    run: function(callback) {
        var anim = this,
            node = anim._node,
            config = anim._config,
            data = {
                type: 'transition:start',
                config: config
            };


        if (!anim._running) {
            anim._running = true;

            if (config.on && config.on.start) {
                config.on.start.call(Y.one(node), data);
            }

            anim.initAttrs(anim._config);

            anim._callback = callback;
            anim._start();
        }


        return anim;
    },

    _start: function() {
        this._runNative();
    },

    _prepDur: function(dur) {
        dur = parseFloat(dur) * 1000;

        return dur + 'ms';
    },

    _runNative: function() {
        var anim = this,
            node = anim._node,
            uid = Y.stamp(node),
            style = node.style,
            computed = node.ownerDocument.defaultView.getComputedStyle(node),
            attrs = Transition._nodeAttrs[uid],
            cssText = '',
            cssTransition = computed[Transition._toCamel(TRANSITION_PROPERTY)],

            transitionText = TRANSITION_PROPERTY + ': ',
            duration = TRANSITION_DURATION + ': ',
            easing = TRANSITION_TIMING_FUNCTION + ': ',
            delay = TRANSITION_DELAY + ': ',
            hyphy,
            attr,
            name;

        // preserve existing transitions
        if (cssTransition !== 'all') {
            transitionText += cssTransition + ',';
            duration += computed[Transition._toCamel(TRANSITION_DURATION)] + ',';
            easing += computed[Transition._toCamel(TRANSITION_TIMING_FUNCTION)] + ',';
            delay += computed[Transition._toCamel(TRANSITION_DELAY)] + ',';

        }

        // run transitions mapped to this instance
        for (name in attrs) {
            hyphy = Transition._toHyphen(name);
            attr = attrs[name];
            if ((attr = attrs[name]) && attr.transition === anim) {
                if (name in node.style) { // only native styles allowed
                    duration += anim._prepDur(attr.duration) + ',';
                    delay += anim._prepDur(attr.delay) + ',';
                    easing += (attr.easing) + ',';

                    transitionText += hyphy + ',';
                    cssText += hyphy + ': ' + attr.value + '; ';
                } else {
                    this.removeProperty(name);
                }
            }
        }

        transitionText = transitionText.replace(/,$/, ';');
        duration = duration.replace(/,$/, ';');
        easing = easing.replace(/,$/, ';');
        delay = delay.replace(/,$/, ';');

        // only one native end event per node
        if (!Transition._hasEnd[uid]) {
            node.addEventListener(TRANSITION_END, anim._onNativeEnd, '');
            Transition._hasEnd[uid] = true;

        }

        style.cssText += transitionText + duration + easing + delay + cssText;

    },

    _end: function(elapsed) {
        var anim = this,
            node = anim._node,
            callback = anim._callback,
            config = anim._config,
            data = {
                type: 'transition:end',
                config: config,
                elapsedTime: elapsed
            },

            nodeInstance = Y.one(node);

        anim._running = false;
        anim._callback = null;

        if (node) {
            if (config.on && config.on.end) {
                setTimeout(function() { // IE: allow previous update to finish
                    config.on.end.call(nodeInstance, data);

                    // nested to ensure proper fire order
                    if (callback) {
                        callback.call(nodeInstance, data);
                    }

                }, 1);
            } else if (callback) {
                setTimeout(function() { // IE: allow previous update to finish
                    callback.call(nodeInstance, data);
                }, 1);
            }
        }

    },

    _endNative: function(name) {
        var node = this._node,
            value = node.ownerDocument.defaultView.getComputedStyle(node, '')[Transition._toCamel(TRANSITION_PROPERTY)];

        name = Transition._toHyphen(name);
        if (typeof value === 'string') {
            value = value.replace(new RegExp('(?:^|,\\s)' + name + ',?'), ',');
            value = value.replace(/^,|,$/, '');
            node.style[TRANSITION_CAMEL] = value;
        }
    },

    _onNativeEnd: function(e) {
        var node = this,
            uid = Y.stamp(node),
            event = e,//e._event,
            name = Transition._toCamel(event.propertyName),
            elapsed = event.elapsedTime,
            attrs = Transition._nodeAttrs[uid],
            attr = attrs[name],
            anim = (attr) ? attr.transition : null,
            data,
            config;

        if (anim) {
            anim.removeProperty(name);
            anim._endNative(name);
            config = anim._config[name];

            data = {
                type: 'propertyEnd',
                propertyName: name,
                elapsedTime: elapsed,
                config: config
            };

            if (config && config.on && config.on.end) {
                config.on.end.call(Y.one(node), data);
            }

            if (anim._count <= 0)  { // after propertyEnd fires
                anim._end(elapsed);
                node.style[TRANSITION_PROPERTY_CAMEL] = ''; // clean up style
            }
        }
    },

    destroy: function() {
        var anim = this,
            node = anim._node;

        if (node) {
            node.removeEventListener(TRANSITION_END, anim._onNativeEnd, false);
            anim._node = null;
        }
    }
};

Y.Transition = Transition;
Y.TransitionNative = Transition; // TODO: remove

/**
 *   Animate one or more css properties to a given value. Requires the "transition" module.
 *   <pre>example usage:
 *       Y.one('#demo').transition({
 *           duration: 1, // in seconds, default is 0.5
 *           easing: 'ease-out', // default is 'ease'
 *           delay: '1', // delay start for 1 second, default is 0
 *
 *           height: '10px',
 *           width: '10px',
 *
 *           opacity: { // per property
 *               value: 0,
 *               duration: 2,
 *               delay: 2,
 *               easing: 'ease-in'
 *           }
 *       });
 *   </pre>
 *   @for Node
 *   @method transition
 *   @param {Object} config An object containing one or more style properties, a duration and an easing.
 *   @param {Function} callback A function to run after the transition has completed.
 *   @chainable
*/
Y.Node.prototype.transition = function(name, config, callback) {
    var
        transitionAttrs = Transition._nodeAttrs[Y.stamp(this._node)],
        anim = (transitionAttrs) ? transitionAttrs.transition || null : null,
        fxConfig,
        prop;

    if (typeof name === 'string') { // named effect, pull config from registry
        if (typeof config === 'function') {
            callback = config;
            config = null;
        }

        fxConfig = Transition.fx[name];

        if (config && typeof config === 'object') {
            config = Y.clone(config);

            for (prop in fxConfig) {
                if (fxConfig.hasOwnProperty(prop)) {
                    if (! (prop in config)) {
                        config[prop] = fxConfig[prop];
                    }
                }
            }
        } else {
            config = fxConfig;
        }

    } else { // name is a config, config is a callback or undefined
        callback = config;
        config = name;
    }

    if (anim && !anim._running) {
        anim.init(this, config);
    } else {
        anim = new Transition(this._node, config);
    }

    anim.run(callback);
    return this;
};

Y.Node.prototype.show = function(name, config, callback) {
    this._show(); // show prior to transition
    if (name && Y.Transition) {
        if (typeof name !== 'string' && !name.push) { // named effect or array of effects supercedes default
            if (typeof config === 'function') {
                callback = config;
                config = name;
            }
            name = Transition.SHOW_TRANSITION;
        }
        this.transition(name, config, callback);
    }
    return this;
};

Y.NodeList.prototype.show = function(name, config, callback) {
    var nodes = this._nodes,
        i = 0,
        node;

    while ((node = nodes[i++])) {
        Y.one(node).show(name, config, callback);
    }

    return this;
};



var _wrapCallBack = function(anim, fn, callback) {
    return function() {
        if (fn) {
            fn.call(anim);
        }
        if (callback && typeof callback === 'function') {
            callback.apply(anim._node, arguments);
        }
    };
};

Y.Node.prototype.hide = function(name, config, callback) {
    if (name && Y.Transition) {
        if (typeof config === 'function') {
            callback = config;
            config = null;
        }

        callback = _wrapCallBack(this, this._hide, callback); // wrap with existing callback
        if (typeof name !== 'string' && !name.push) { // named effect or array of effects supercedes default
            if (typeof config === 'function') {
                callback = config;
                config = name;
            }
            name = Transition.HIDE_TRANSITION;
        }
        this.transition(name, config, callback);
    } else {
        this._hide();
    }
    return this;
};

Y.NodeList.prototype.hide = function(name, config, callback) {
    var nodes = this._nodes,
        i = 0,
        node;

    while ((node = nodes[i++])) {
        Y.one(node).hide(name, config, callback);
    }

    return this;
};

/**
 *   Animate one or more css properties to a given value. Requires the "transition" module.
 *   <pre>example usage:
 *       Y.all('.demo').transition({
 *           duration: 1, // in seconds, default is 0.5
 *           easing: 'ease-out', // default is 'ease'
 *           delay: '1', // delay start for 1 second, default is 0
 *
 *           height: '10px',
 *           width: '10px',
 *
 *           opacity: { // per property
 *               value: 0,
 *               duration: 2,
 *               delay: 2,
 *               easing: 'ease-in'
 *           }
 *       });
 *   </pre>
 *   @for NodeList
 *   @method transition
 *   @param {Object} config An object containing one or more style properties, a duration and an easing.
 *   @param {Function} callback A function to run after the transition has completed. The callback fires
 *       once per item in the NodeList.
 *   @param {Boolean} callbackOnce If true, the callback will be called only after the
 *       last transition has completed
 *   @chainable
*/
Y.NodeList.prototype.transition = function(config, callback, callbackOnce) {
    var nodes = this._nodes,
        size = this.size(),
         i = 0,
        callbackOnce = callbackOnce === true,
        node;

    while ((node = nodes[i++])) {
        if (i < size && callbackOnce){
            Y.one(node).transition(config);
        } else {
            Y.one(node).transition(config, callback);
        }
    }

    return this;
};

Y.Node.prototype.toggleView = function(name, on, callback) {
    this._toggles = this._toggles || [];
    callback = arguments[arguments.length - 1];

    if (typeof name !== 'string') { // no transition, just toggle
        on = name;
        this._toggleView(on, callback); // call original _toggleView in Y.Node
        return;
    }

    if (typeof on === 'function') { // Ignore "on" if used for callback argument.
        on = undefined;
    }

    if (typeof on === 'undefined' && name in this._toggles) { // reverse current toggle
        on = ! this._toggles[name];
    }

    on = (on) ? 1 : 0;
    if (on) {
        this._show();
    }  else {
        callback = _wrapCallBack(this, this._hide, callback);
    }

    this._toggles[name] = on;
    this.transition(Y.Transition.toggles[name][on], callback);

    return this;
};

Y.NodeList.prototype.toggleView = function(name, on, callback) {
    var nodes = this._nodes,
        i = 0,
        node;

    while ((node = nodes[i++])) {
        node = Y.one(node);
        node.toggleView.apply(node, arguments);
    }

    return this;
};

Y.mix(Transition.fx, {
    fadeOut: {
        opacity: 0,
        duration: 0.5,
        easing: 'ease-out'
    },

    fadeIn: {
        opacity: 1,
        duration: 0.5,
        easing: 'ease-in'
    },

    sizeOut: {
        height: 0,
        width: 0,
        duration: 0.75,
        easing: 'ease-out'
    },

    sizeIn: {
        height: function(node) {
            return node.get('scrollHeight') + 'px';
        },
        width: function(node) {
            return node.get('scrollWidth') + 'px';
        },
        duration: 0.5,
        easing: 'ease-in',

        on: {
            start: function() {
                var overflow = this.getStyle('overflow');
                if (overflow !== 'hidden') { // enable scrollHeight/Width
                    this.setStyle('overflow', 'hidden');
                    this._transitionOverflow = overflow;
                }
            },

            end: function() {
                if (this._transitionOverflow) { // revert overridden value
                    this.setStyle('overflow', this._transitionOverflow);
                    delete this._transitionOverflow;
                }
            }
        }
    }
});

Y.mix(Transition.toggles, {
    size: ['sizeOut', 'sizeIn'],
    fade: ['fadeOut', 'fadeIn']
});


}, '3.17.1', {"requires": ["node-style"]});
