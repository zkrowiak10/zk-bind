/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./scripts/src/ObservableObject.ts":
/*!*****************************************!*\
  !*** ./scripts/src/ObservableObject.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "ObservableObject": () => (/* binding */ ObservableObject),
/* harmony export */   "makeObservable": () => (/* binding */ makeObservable)
/* harmony export */ });
/* harmony import */ var _zk__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./zk */ "./scripts/src/zk.ts");

class ObservableObject {
    constructor(obj, parent) {
        this.receivers = [];
        this.transmitters = [];
        this.forEachComponents = [];
        this.subscribers = [];
        this.handler = {
            get: (target, property, receiver) => {
                if (typeof target[property] == "function") {
                    if (target instanceof Date) {
                        // @ts-ignore
                        return target[property].bind(target);
                    }
                }
                // for certain operations, it is necessary to verify that the target object is the same spot in memory as
                // some other reference to it.
                if (property == "_targetObject") {
                    return target;
                }
                if (property == "_observableObject") {
                    return this;
                }
                if (property == "$parentModel") {
                    return this.$parentModel;
                }
                if (property == "$model") {
                    return this.$model;
                }
                return target[property];
            },
            set: (target, property, value) => {
                if (Array.isArray(target)) {
                    this.updateArrayOnSet(target, property, value);
                    return true;
                }
                if (property == "$model") {
                    this[property] = value;
                }
                target[property] = value;
                this.updateOnStateChangeByOref(target, property);
                return true;
            },
            deleteProperty: (target, property) => {
                if (Array.isArray(target)) {
                    this.updateArrayOnDelete(target, property);
                    return true;
                }
                delete target[property];
                return true;
            },
        };
        this.dataObject = obj;
        this.parent = parent;
        this.dataObjectProxy = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.deepProxy(this.dataObject, this.handler);
    }
    getProxy() {
        return this.dataObjectProxy;
    }
    // Function to update all elements on state change by oref
    // Function receives the object which contains the updated property, and the property key
    updateOnStateChangeByOref(oRefParent, property) {
        for (let element of this.receivers) {
            if (element.target._targetObject === oRefParent &&
                property == element.property) {
                element.update();
            }
        }
    }
    // Parse property path of binding and return object at that location
    returnTargetProperty(pathToObject, getParent = false) {
        let targetChild = this.dataObjectProxy;
        let splitPath = pathToObject.split(".");
        if (splitPath[0] == "root") {
            targetChild = _zk__WEBPACK_IMPORTED_MODULE_0__.zk.root_model;
        }
        if (splitPath[0] == "$parentModel") {
            targetChild = this.$parentModel;
            let i = 1;
            while (splitPath[i] == "$parentModel") {
                targetChild = targetChild.$parentModel;
            }
        }
        for (let i = 1; i < splitPath.length; i++) {
            if (getParent && i == splitPath.length - 1) {
                return targetChild;
            }
            targetChild = targetChild[splitPath[i]];
            if (typeof targetChild === "undefined") {
                throw new Error(pathToObject + " is an invalid property path");
            }
        }
        return targetChild;
    }
    // take a bound 'transmitter' element and add an event lister to update model object and transmit to receivers
    initializeTransmitter(boundElement, bindMode) {
        // A transmitter should always be an input element in HTML. Currently, the supported elemetns
        // Are text, date, datetime, checked
        let target = boundElement.target;
        let property = boundElement.property;
        let updateValue = target[property];
        if (!(boundElement instanceof _zk__WEBPACK_IMPORTED_MODULE_0__.BoundElement)) {
            throw new Error("Invalid argument to initialize transmitter");
        }
        if (bindMode == "radio") {
            let options = boundElement.DOMelement.querySelectorAll("input");
            for (let option of options) {
                if (option.value == updateValue) {
                    option.checked = true;
                }
                option.addEventListener("input", function () {
                    if (option.checked) {
                        target[property] = option.value;
                    }
                });
            }
            return;
        }
        if (!(boundElement.DOMelement instanceof HTMLInputElement)) {
            throw new Error(`Invalid html element binding: "${bindMode}" must be bound to an input element`);
        }
        if (boundElement.DOMelement.type == "date") {
            if (updateValue) {
                updateValue = new Date(updateValue);
                try {
                    updateValue = updateValue.toISOString().split("T")[0];
                }
                catch (err) {
                    console.error("error converting date object", updateValue, err.message);
                }
            }
        }
        if (bindMode == "datetime-local") {
            updateValue = new Date(updateValue);
            updateValue = updateValue._targetObject.toISOString();
        }
        boundElement.DOMelement.value = updateValue || "";
        boundElement.DOMelement.addEventListener("input", () => {
            if (boundElement.DOMelement instanceof HTMLInputElement) {
                let nodeValue = boundElement.DOMelement.value;
                if (bindMode == "date") {
                    nodeValue = new Date(nodeValue);
                    return;
                }
                if (boundElement.DOMelement.type == "checkbox") {
                    nodeValue = boundElement.DOMelement.checked;
                }
                target[property] = nodeValue || "";
            }
        });
    }
    // A 'for' binder repeats the syntax in the children elements for each item in the defined iterable
    // This function must be able to control the items in the list (push/pop) and change their value if the
    // model data changes.
    initializeForeach(boundElement) {
        // parse syntax, note that 'objectPath' refers to the foreach syntax of the for element
        // which follows foreach syntax (item of list)
        let tempList = boundElement.objectPath.split("of");
        let iteratorKey = tempList[0].trim();
        let iterableObjectPath = tempList[1].trim();
        let iterable = this.returnTargetProperty(iterableObjectPath);
        if (boundElement.DOMelement.children.length > 1) {
            console.error(`For element must have only one child at`, boundElement.DOMelement);
            return;
        }
        let templateNode = boundElement.DOMelement.removeChild(boundElement.DOMelement.children[0]);
        if (!(templateNode instanceof HTMLElement)) {
            throw new Error("Template node must be instance of HTMLElement");
        }
        // The current bound element is the 'for' parent element containing the iterated objects
        // this element needs to store all of its children, the html template for creating a new child,
        // and the iteratore key (eg 'item')
        boundElement.objectPath = iterableObjectPath;
        let oRefPath = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.prepareObjectPath(boundElement.objectPath);
        boundElement.target = iterable;
        boundElement.observableChildren = [];
        boundElement.templateNode = templateNode;
        boundElement.iteratorKey = iteratorKey;
        // The application should enforce that the boundElement only has one root (the iterator template)
        // Then, it should clone that item and append it iterable.length - 1 times
        // The parent object (curent boundElement) needs to be added to the bound elements array
        // problem noted: when the ObservableObject instantiates, it copies the object parameter, meaning that scoped sub models
        // Do not reflect changes to the object model they are descendent from
        let index = 0;
        if (!Array.isArray(iterable)) {
            throw new Error(`'For' element much bind to an iterable at ${boundElement.DOMelement}`);
        }
        for (let item of iterable) {
            // Create clone of template node for each bound element
            let clone = templateNode.cloneNode(true);
            boundElement.DOMelement.appendChild(clone);
            // a 'for' element creates its own autonomous model scope with the 'item' being a new observable object inserted into
            // a sub model
            let subModel = {};
            let newObj = new ObservableObject(item, this);
            subModel[iteratorKey] = newObj.dataObjectProxy;
            subModel.$parentModel = this.$model;
            newObj.$model = subModel;
            if (!(clone instanceof HTMLElement)) {
                throw new Error(`'for' binding template node must be an instance of HTMLElement at ${clone}`);
            }
            (0,_zk__WEBPACK_IMPORTED_MODULE_0__.ParseDOMforObservables)(subModel, clone);
            var subModelContext = {
                subModel: subModel,
                node: clone,
            };
            boundElement.observableChildren.push(subModelContext);
            // replace array item with its observable version
            iterable[index++] = newObj.dataObjectProxy;
        }
        this.forEachComponents.push(boundElement);
    }
    updateArrayOnSet(targetArr, targetProperty, value) {
        // locate appropriate array of bound elements in forEachComponents (this should be a 'for' element)
        // targetArr is an array part of the obj argument to observable object, this function is called when updating
        // its Proxy object.
        var boundElement;
        // Find the correct BoundElement in the list of 'forEachComponents',
        // which represent all arrays inside of the ObservableObject
        // that have been bound to a for binding in the DOM.
        for (let item of this.forEachComponents) {
            if (item.target._targetObject == targetArr) {
                boundElement = item;
                break;
            }
        }
        if (targetProperty == "length") {
            targetArr[targetProperty] = value;
            if (boundElement) {
                boundElement.observableChildren.length = value;
                while (boundElement.DOMelement.children.length > value) {
                    boundElement.DOMelement.lastChild.remove();
                }
            }
            return;
        }
        if (typeof targetProperty == "string") {
            targetProperty = Number.parseInt(targetProperty);
        }
        // Presence of boundElement means that this array is bound to a DOM element
        if (boundElement) {
            let insertNode;
            // construct new child node
            insertNode = boundElement.templateNode.cloneNode(true);
            if (!(insertNode instanceof HTMLElement)) {
                throw new Error(`Template node is not of type HTMLElement`);
            }
            let subModel = {};
            // If value being set is not an observable object
            if (!value._observableObject) {
                // creat subModel for child node observable scope and add the observable to the array
                value = new ObservableObject(value).dataObjectProxy;
                subModel[boundElement.iteratorKey] = value;
                value._observableObject.$model = subModel;
                subModel.$parentModel = this.$model;
                // Create submodel context that stores node-element pairing
                let subModelContext = {
                    subModel: subModel,
                    node: insertNode,
                };
                boundElement.observableChildren[targetProperty] = subModelContext;
                (0,_zk__WEBPACK_IMPORTED_MODULE_0__.ParseDOMforObservables)(subModel, insertNode);
            }
            // this makes assumption that if it is NOT an observable object, it is an existing item in the array.
            else {
                // Locate the observable child of the bound 'for' element where
                // the observable object at observableChild.subModel[iteratorKey]
                // equals the value parameter of this function
                // Reminder: 'iteratorKey' is whatever the DOM element declares a <item> in the foreach bind
                let iteratorKey = boundElement.iteratorKey;
                let observableChild = boundElement.observableChildren.find((item) => {
                    return item.subModel[iteratorKey] == value;
                });
                // if the inserted object is an observable, but is not currently in the bound array
                if (!observableChild) {
                    subModel[boundElement.iteratorKey] = value;
                    value._observableObject.$model = subModel;
                    subModel.$parentModel = this.$model;
                    // Create submodel context that stores node-element pairing
                    let subModelContext = {
                        subModel: subModel,
                        node: insertNode,
                    };
                    boundElement.observableChildren[targetProperty] = subModelContext;
                    (0,_zk__WEBPACK_IMPORTED_MODULE_0__.ParseDOMforObservables)(subModel, insertNode);
                }
                else {
                    boundElement.observableChildren[targetProperty] = observableChild;
                    // Reminder: 'observableChild' refers to a subModelContext containing a submodel and a html node
                    (0,_zk__WEBPACK_IMPORTED_MODULE_0__.ParseDOMforObservables)(observableChild.subModel, insertNode);
                }
            }
            // Insert node in appropriate index position
            // Get current node at that position
            let currentIndex = boundElement.DOMelement.children[targetProperty];
            if (Number(targetProperty) == boundElement.DOMelement.children.length) {
                boundElement.DOMelement.appendChild(insertNode);
            }
            else {
                boundElement.DOMelement.replaceChild(insertNode, currentIndex);
            }
        }
        // push the object to the the data object proxy array
        targetArr[targetProperty] = value;
    }
    updateArrayOnDelete(targetArr, targetProperty) {
        let boundElement;
        if (typeof targetProperty == "string") {
            if (Number.parseInt(targetProperty) == NaN) {
                throw new Error("Array index must be an integer value");
            }
        }
        for (let item of this.forEachComponents) {
            if (item.target._targetObject == targetArr) {
                boundElement = item;
                break;
            }
        }
        if (typeof targetProperty == "string") {
            targetProperty = Number.parseInt(targetProperty);
        }
        // Presence of boundElement means that this array is bound to a DOM element
        if (boundElement) {
            // find the node in the for element to delete and delete it from DOM
            let currentIndex = boundElement.DOMelement.children[targetProperty];
            boundElement.DOMelement.removeChild(currentIndex);
            // remove element from observable children to maintain parity between that list and the targetArr
            delete boundElement.observableChildren[targetProperty];
        }
        // Finally, delete element in targetArr
        delete targetArr[targetProperty];
    }
    // function to register an element, perform any intialization,a nd add to appropriate array
    registerElement(bindMode, boundElement) {
        let objectPath;
        var callBackPath;
        var attr;
        var binding;
        var targetPath;
        switch (bindMode) {
            case "text":
            case "checked":
            case "radio":
            case "date":
                this.transmitters.push(boundElement);
                let oRefPath = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.prepareObjectPath(boundElement.objectPath);
                boundElement.target = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.returnTargetProperty(this.dataObjectProxy, oRefPath, true);
                var splitPath = boundElement.objectPath.split(".");
                boundElement.property = splitPath[splitPath.length - 1];
                this.initializeTransmitter(boundElement, bindMode);
                break;
            case "format":
                // format binds have syntax "format: objectPath|callbackFunction"
                [objectPath, callBackPath] = boundElement.objectPath.split("|");
                try {
                    boundElement.updateCallback = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.returnTargetProperty(this.dataObjectProxy, callBackPath);
                }
                catch (err) {
                    console.error(err.message);
                }
                boundElement.objectPath = objectPath;
            case "value":
                targetPath = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.prepareObjectPath(boundElement.objectPath);
                boundElement.target = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.returnTargetProperty(this.dataObjectProxy, targetPath, true);
                splitPath = boundElement.objectPath.split(".");
                boundElement.property = splitPath[splitPath.length - 1];
                this.receivers.push(boundElement);
                boundElement.update();
                break;
            case "attr":
                // attr bindings follow syntax "attr: targetAttr|binding"
                [attr, binding, callBackPath] = boundElement.objectPath.split("|");
                if (callBackPath) {
                    try {
                        boundElement.updateCallback = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.returnTargetProperty(this.dataObjectProxy, callBackPath);
                    }
                    catch (err) {
                        console.error(err.message);
                    }
                }
                boundElement.objectPath = binding;
                splitPath = boundElement.objectPath.split(".");
                boundElement.property = splitPath[splitPath.length - 1];
                targetPath = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.prepareObjectPath(boundElement.objectPath);
                boundElement.target = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.returnTargetProperty(this.dataObjectProxy, targetPath, true);
                splitPath = boundElement.objectPath.split(".");
                this.receivers.push(boundElement);
                boundElement.attr = attr;
                boundElement.update();
                break;
            case "for":
                this.initializeForeach(boundElement);
                break;
            case "hidden":
                targetPath = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.prepareObjectPath(boundElement.objectPath);
                boundElement.target = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.returnTargetProperty(this.dataObjectProxy, targetPath, true);
                splitPath = boundElement.objectPath.split(".");
                boundElement.property = splitPath[splitPath.length - 1];
                this.receivers.push(boundElement);
                boundElement.update = function () {
                    boundElement.DOMelement.hidden =
                        boundElement.target[boundElement.property];
                };
                boundElement.update();
                break;
            case "visible":
                targetPath = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.prepareObjectPath(boundElement.objectPath);
                boundElement.target = _zk__WEBPACK_IMPORTED_MODULE_0__.utils.returnTargetProperty(this.dataObjectProxy, targetPath, true);
                splitPath = boundElement.objectPath.split(".");
                boundElement.property = splitPath[splitPath.length - 1];
                this.receivers.push(boundElement);
                boundElement.update = function () {
                    boundElement.DOMelement.hidden =
                        !boundElement.target[boundElement.property];
                };
                boundElement.update();
                break;
        }
    }
}
function makeObservable(obj, parent) {
    var observable = new ObservableObject(obj);
    return observable.getProxy();
}


/***/ }),

/***/ "./scripts/src/zk.ts":
/*!***************************!*\
  !*** ./scripts/src/zk.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "BoundElement": () => (/* binding */ BoundElement),
/* harmony export */   "utils": () => (/* binding */ utils),
/* harmony export */   "zk": () => (/* binding */ zk),
/* harmony export */   "ParseDOMforObservables": () => (/* binding */ ParseDOMforObservables)
/* harmony export */ });
/* harmony import */ var _ObservableObject__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ObservableObject */ "./scripts/src/ObservableObject.ts");


const zk = {
    root_model: {},
    makeObservable: _ObservableObject__WEBPACK_IMPORTED_MODULE_0__.makeObservable,
    initiateModel: initiateModel,
};
// Function to initiate any object variables accessible to all zk objects
// Then begin recursively parsing DOM for observable elements
// Parameters
// Model: an object containing observable objects
// Root: An html node that is the root element of all observable objects
function initiateModel(model, root) {
    for (let object in model) {
        if (!model[object]) {
            continue;
        }
        if (model[object]._observableObject) {
            model[object]._observableObject.$model = model;
        }
    }
    if (!(root instanceof HTMLElement)) {
        throw new Error("Invalid argument: second parameter must be an HTML element");
    }
    ParseDOMforObservables(model, root);
}
// Recursive function that locates and registers any html element descending from root that should be observed
function ParseDOMforObservables(model, root) {
    var isIndependentElement = false;
    // if HTML element contains binder
    if (root.getAttribute("zk-bind")) {
        // parse the bind command
        // bind syntax is '<bindMode>: <object path'
        const zkbind = root.getAttribute("zk-bind");
        var bindingExpressions = [];
        if (zkbind) {
            bindingExpressions = zkbind.split(";");
        }
        for (let binder of bindingExpressions) {
            const splitBinder = binder.split(":");
            if (splitBinder.length < 2) {
                throw new Error(`Invalid binding at: ${root}`);
            }
            // isolate bindMode string and object path (getting rid of preceding white space)
            const bindMode = splitBinder[0];
            const objectPath = splitBinder[1].trim();
            // Current array of valid bind modes for validity checking
            const validBindModes = [
                "text",
                "value",
                "for",
                "date",
                "on",
                "format",
                "checkbox",
                "attr",
                "hidden",
                "visible",
                "radio",
            ];
            // Verify that bind mode is valid
            if (!validBindModes.includes(bindMode)) {
                console.error(bindMode + " is not a valid bind mode");
                continue;
            }
            // Parent object in path is expected to be an attribute of the model parameter of this function
            // Parse parent object, and add this element to the appropriate list
            let parentObject = objectPath.split(".")[0];
            // A little messy, but 'for' binders receive an argument of 'indexKey of iterable' where
            // iterable is the typical objectpaty.
            if (bindMode === "for") {
                parentObject = objectPath.split("of")[1].trim().split(".")[0];
            }
            // Push the element to the appropriate list
            // Placeholder for bindmode until parsing occers.
            // TODO: make register element pass parsing to bound element rather than do it on the object itself.
            const boundElement = new BoundElement(root, objectPath, bindMode, "");
            if (bindMode === "on") {
                registerListener(boundElement, model);
                continue;
            }
            if (bindMode === "attr") {
                parentObject = objectPath.split("|")[1].split(".")[0];
            }
            if (typeof parentObject === "undefined" ||
                typeof model[parentObject] === "undefined") {
                console.error("Invald object path at ", binder, "with model: ", model);
                continue;
            }
            let observableTarget;
            observableTarget = model[parentObject]._observableObject;
            if (!observableTarget) {
                console.warn(`attempting to bind on non-observable object at`, boundElement.DOMelement);
                if (bindMode === "value") {
                    root.innerText = utils.returnTargetProperty(model, objectPath, false);
                }
                continue;
            }
            observableTarget.registerElement(bindMode, boundElement);
            // Some binders, such as 'for' binders, create a separate tree model for all of their children
            // This array contains a list of all 'uprooting' binders
            let uprootingBinders = ["for"];
            // This root becomes a new tree, so now further exploration of this branch can happen to avoid duplicate bindings
            if (uprootingBinders.includes(bindMode)) {
                isIndependentElement = true;
            }
        }
    }
    if (isIndependentElement) {
        return;
    }
    const children = root.children;
    // iterate through children
    for (let child of children) {
        if (child instanceof HTMLElement) {
            // Recursively parse all children of current root element
            ParseDOMforObservables(model, child);
        }
    }
}
// instantiates a bound element storing the DOM element and the object path to which it is linked
class BoundElement {
    constructor(DOMelement, objectPath, bindMode, property) {
        this.DOMelement = DOMelement;
        this.objectPath = objectPath;
        this.bindMode = bindMode;
        this.property = property;
    }
    update() {
        let value = this.target[this.property];
        if (this.updateCallback) {
            value = this.updateCallback(value);
            // TODO add configuration callbacks for date string formatting
        }
        switch (this.bindMode) {
            case "attr":
                if (!this.attr) {
                    throw new Error("No attr value defined for bound element");
                }
                this.DOMelement.setAttribute(this.attr, value);
                return;
        }
        this.DOMelement.innerText = value;
    }
}
// 'on' binds have an object path of <event>|<callback>
function registerListener(boundElement, model) {
    // Locate split end parentheses off
    let eventType, methodSignature;
    [eventType, methodSignature] = boundElement.objectPath.split("|");
    const methodName = methodSignature.split("(")[0];
    const parameters = methodSignature.split("(")[1].split(")")[0];
    const argArray = [];
    for (let key of parameters.split(",")) {
        argArray.push(model[key]);
    }
    try {
        let callbackParent = utils.returnTargetProperty(model, methodName, true);
        let callback = utils.returnTargetProperty(model, methodName);
        if (!callback) {
            throw new Error("callback not found at " + methodSignature + "in model: " + model);
        }
        boundElement.DOMelement.addEventListener(eventType, function () {
            callback.apply(callbackParent, argArray);
        });
    }
    catch (err) {
        console.error(`${err.name}: ${err.message}`);
    }
}
let utils = {
    deepClone: function deepClone(object) {
        var newObject = {};
        if (Array.isArray(object)) {
            let newArray = [];
            for (let item of object) {
                let cloneItem = deepClone(item);
                newArray.push(cloneItem);
            }
            if (typeof object != "object") {
                return object;
            }
        }
        for (let property in object) {
            newObject[property] = deepClone(object[property]);
        }
        return newObject;
    },
    deepProxy: function deepProxy(object, handler) {
        // do not remake observable objects
        if (typeof object === "function") {
            return new Proxy(object, handler);
        }
        if (Array.isArray(object)) {
            for (let i = 0; i < object.length; i++) {
                object[i] = deepProxy(object[i], handler);
            }
            object = new Proxy(object, handler);
            return object;
        }
        for (let item in object) {
            if (typeof object[item] === "object") {
                object[item] = deepProxy(object[item], handler);
            }
        }
        if (typeof object === "object" && object) {
            return new Proxy(object, handler);
        }
        return object;
    },
    // method to remove first and last object for oRef attribut
    prepareObjectPath: function (objectPath) {
        let objArray = objectPath.split(".");
        let property = objArray[objArray.length - 1];
        objArray = objArray.splice(1);
        objArray = objArray.join(".");
        return objArray;
    },
    // generalizing the method to access object property using string path such as "person.task.dueDate"
    returnTargetProperty: function returnTargetProperty(objectTarget, pathToObject, getParent) {
        let targetChild = objectTarget;
        let splitPath = pathToObject.split(".");
        let i = 0;
        if (splitPath[0] === "root") {
            targetChild = zk.root_model;
            i++;
        }
        while (i < splitPath.length) {
            if (getParent && i === splitPath.length - 1) {
                return targetChild;
            }
            targetChild = targetChild[splitPath[i]];
            if (!targetChild) {
                throw new Error(pathToObject + " is an invalid property path");
            }
            i++;
        }
        return targetChild;
    },
};


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be isolated against other modules in the chunk.
(() => {
/*!*******************************************!*\
  !*** ./scripts/test_client/playClient.js ***!
  \*******************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _src_zk__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../src/zk */ "./scripts/src/zk.ts");


let person = {
  name: "harry",
  lastName: "banana",
  listItems: [
    { prop: "1", prop2: "eric", prop3: "three" },
    { prop: "2", prop2: "eric", prop3: "three" },
    { prop: "3", prop2: "eric", prop3: "three" },
    { prop: "4", prop2: "eric", prop3: "three" },
    { prop: "5", prop2: "eric", prop3: "three" },
  ],
};

function model() {
  this.person =  _src_zk__WEBPACK_IMPORTED_MODULE_0__.zk.makeObservable(person);

  let employee = {
    hairdo: "orange",
    manager: {
      report: {
        firstName: "johnathan",
      },
    },
    testF: function () { 
      console.log("testfworked");
    },
  };
  this.employee =  _src_zk__WEBPACK_IMPORTED_MODULE_0__.zk.makeObservable(employee);

  this.addTaskFormValue =  _src_zk__WEBPACK_IMPORTED_MODULE_0__.zk.makeObservable({
    prop: "prop",
    prop2: "prop2",
    prop3: "three",
  });

  this.saveTask = function () {
    // this.person.pushToForeach('person.listItems',this.addTaskFormValue.getdataObjectProxy())
    this.person.listItems.push(this.addTaskFormValue);
  };
  this.removeItem = function (item) {
    let index = person.listItems.indexOf(item);
    person.listItems.splice(index, 1);
  };
  this.param = "foo";
  this.jam = "bar";

  this.testFunction = function (x, y) {
    console.log(x, y);
  };
}

const mainModel = new model();

_src_zk__WEBPACK_IMPORTED_MODULE_0__.zk.initiateModel(mainModel, document.children[0]);

})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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QTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ087QUFDUDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsZ0RBQWdEO0FBQ2hEO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsdURBQXVELEtBQUs7QUFDNUQ7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0EseUJBQXlCLFNBQVMsSUFBSSxZQUFZO0FBQ2xEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDRCQUE0QixtQkFBbUI7QUFDL0M7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMOzs7Ozs7O1VDL09BO1VBQ0E7O1VBRUE7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7VUFDQTtVQUNBO1VBQ0E7O1VBRUE7VUFDQTs7VUFFQTtVQUNBO1VBQ0E7Ozs7O1dDdEJBO1dBQ0E7V0FDQTtXQUNBO1dBQ0EseUNBQXlDLHdDQUF3QztXQUNqRjtXQUNBO1dBQ0E7Ozs7O1dDUEE7Ozs7O1dDQUE7V0FDQTtXQUNBO1dBQ0EsdURBQXVELGlCQUFpQjtXQUN4RTtXQUNBLGdEQUFnRCxhQUFhO1dBQzdEOzs7Ozs7Ozs7Ozs7QUNONEI7O0FBRTVCO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsTUFBTSwwQ0FBMEM7QUFDaEQsTUFBTSwwQ0FBMEM7QUFDaEQsTUFBTSwwQ0FBMEM7QUFDaEQsTUFBTSwwQ0FBMEM7QUFDaEQsTUFBTSwwQ0FBMEM7QUFDaEQ7QUFDQTs7QUFFQTtBQUNBLGlCQUFpQixzREFBaUI7O0FBRWxDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQSxtQkFBbUIsc0RBQWlCOztBQUVwQywyQkFBMkIsc0RBQWlCO0FBQzVDO0FBQ0E7QUFDQTtBQUNBLEdBQUc7O0FBRUg7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUEscURBQWdCIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vdG9kb2lzdHZhbmlsbGFqcy8uL3NjcmlwdHMvc3JjL09ic2VydmFibGVPYmplY3QudHMiLCJ3ZWJwYWNrOi8vdG9kb2lzdHZhbmlsbGFqcy8uL3NjcmlwdHMvc3JjL3prLnRzIiwid2VicGFjazovL3RvZG9pc3R2YW5pbGxhanMvd2VicGFjay9ib290c3RyYXAiLCJ3ZWJwYWNrOi8vdG9kb2lzdHZhbmlsbGFqcy93ZWJwYWNrL3J1bnRpbWUvZGVmaW5lIHByb3BlcnR5IGdldHRlcnMiLCJ3ZWJwYWNrOi8vdG9kb2lzdHZhbmlsbGFqcy93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL3RvZG9pc3R2YW5pbGxhanMvd2VicGFjay9ydW50aW1lL21ha2UgbmFtZXNwYWNlIG9iamVjdCIsIndlYnBhY2s6Ly90b2RvaXN0dmFuaWxsYWpzLy4vc2NyaXB0cy90ZXN0X2NsaWVudC9wbGF5Q2xpZW50LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJvdW5kRWxlbWVudCwgdXRpbHMsIHprLCBQYXJzZURPTWZvck9ic2VydmFibGVzLCB9IGZyb20gXCIuL3prXCI7XG5leHBvcnQgY2xhc3MgT2JzZXJ2YWJsZU9iamVjdCB7XG4gICAgY29uc3RydWN0b3Iob2JqLCBwYXJlbnQpIHtcbiAgICAgICAgdGhpcy5yZWNlaXZlcnMgPSBbXTtcbiAgICAgICAgdGhpcy50cmFuc21pdHRlcnMgPSBbXTtcbiAgICAgICAgdGhpcy5mb3JFYWNoQ29tcG9uZW50cyA9IFtdO1xuICAgICAgICB0aGlzLnN1YnNjcmliZXJzID0gW107XG4gICAgICAgIHRoaXMuaGFuZGxlciA9IHtcbiAgICAgICAgICAgIGdldDogKHRhcmdldCwgcHJvcGVydHksIHJlY2VpdmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB0YXJnZXRbcHJvcGVydHldID09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgRGF0ZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldFtwcm9wZXJ0eV0uYmluZCh0YXJnZXQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIC8vIGZvciBjZXJ0YWluIG9wZXJhdGlvbnMsIGl0IGlzIG5lY2Vzc2FyeSB0byB2ZXJpZnkgdGhhdCB0aGUgdGFyZ2V0IG9iamVjdCBpcyB0aGUgc2FtZSBzcG90IGluIG1lbW9yeSBhc1xuICAgICAgICAgICAgICAgIC8vIHNvbWUgb3RoZXIgcmVmZXJlbmNlIHRvIGl0LlxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PSBcIl90YXJnZXRPYmplY3RcIikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgPT0gXCJfb2JzZXJ2YWJsZU9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgPT0gXCIkcGFyZW50TW9kZWxcIikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy4kcGFyZW50TW9kZWw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmIChwcm9wZXJ0eSA9PSBcIiRtb2RlbFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLiRtb2RlbDtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldFtwcm9wZXJ0eV07XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgc2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoQXJyYXkuaXNBcnJheSh0YXJnZXQpKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlQXJyYXlPblNldCh0YXJnZXQsIHByb3BlcnR5LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAocHJvcGVydHkgPT0gXCIkbW9kZWxcIikge1xuICAgICAgICAgICAgICAgICAgICB0aGlzW3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgdGhpcy51cGRhdGVPblN0YXRlQ2hhbmdlQnlPcmVmKHRhcmdldCwgcHJvcGVydHkpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGRlbGV0ZVByb3BlcnR5OiAodGFyZ2V0LCBwcm9wZXJ0eSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHRhcmdldCkpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVBcnJheU9uRGVsZXRlKHRhcmdldCwgcHJvcGVydHkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVsZXRlIHRhcmdldFtwcm9wZXJ0eV07XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICB9O1xuICAgICAgICB0aGlzLmRhdGFPYmplY3QgPSBvYmo7XG4gICAgICAgIHRoaXMucGFyZW50ID0gcGFyZW50O1xuICAgICAgICB0aGlzLmRhdGFPYmplY3RQcm94eSA9IHV0aWxzLmRlZXBQcm94eSh0aGlzLmRhdGFPYmplY3QsIHRoaXMuaGFuZGxlcik7XG4gICAgfVxuICAgIGdldFByb3h5KCkge1xuICAgICAgICByZXR1cm4gdGhpcy5kYXRhT2JqZWN0UHJveHk7XG4gICAgfVxuICAgIC8vIEZ1bmN0aW9uIHRvIHVwZGF0ZSBhbGwgZWxlbWVudHMgb24gc3RhdGUgY2hhbmdlIGJ5IG9yZWZcbiAgICAvLyBGdW5jdGlvbiByZWNlaXZlcyB0aGUgb2JqZWN0IHdoaWNoIGNvbnRhaW5zIHRoZSB1cGRhdGVkIHByb3BlcnR5LCBhbmQgdGhlIHByb3BlcnR5IGtleVxuICAgIHVwZGF0ZU9uU3RhdGVDaGFuZ2VCeU9yZWYob1JlZlBhcmVudCwgcHJvcGVydHkpIHtcbiAgICAgICAgZm9yIChsZXQgZWxlbWVudCBvZiB0aGlzLnJlY2VpdmVycykge1xuICAgICAgICAgICAgaWYgKGVsZW1lbnQudGFyZ2V0Ll90YXJnZXRPYmplY3QgPT09IG9SZWZQYXJlbnQgJiZcbiAgICAgICAgICAgICAgICBwcm9wZXJ0eSA9PSBlbGVtZW50LnByb3BlcnR5KSB7XG4gICAgICAgICAgICAgICAgZWxlbWVudC51cGRhdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbiAgICAvLyBQYXJzZSBwcm9wZXJ0eSBwYXRoIG9mIGJpbmRpbmcgYW5kIHJldHVybiBvYmplY3QgYXQgdGhhdCBsb2NhdGlvblxuICAgIHJldHVyblRhcmdldFByb3BlcnR5KHBhdGhUb09iamVjdCwgZ2V0UGFyZW50ID0gZmFsc2UpIHtcbiAgICAgICAgbGV0IHRhcmdldENoaWxkID0gdGhpcy5kYXRhT2JqZWN0UHJveHk7XG4gICAgICAgIGxldCBzcGxpdFBhdGggPSBwYXRoVG9PYmplY3Quc3BsaXQoXCIuXCIpO1xuICAgICAgICBpZiAoc3BsaXRQYXRoWzBdID09IFwicm9vdFwiKSB7XG4gICAgICAgICAgICB0YXJnZXRDaGlsZCA9IHprLnJvb3RfbW9kZWw7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHNwbGl0UGF0aFswXSA9PSBcIiRwYXJlbnRNb2RlbFwiKSB7XG4gICAgICAgICAgICB0YXJnZXRDaGlsZCA9IHRoaXMuJHBhcmVudE1vZGVsO1xuICAgICAgICAgICAgbGV0IGkgPSAxO1xuICAgICAgICAgICAgd2hpbGUgKHNwbGl0UGF0aFtpXSA9PSBcIiRwYXJlbnRNb2RlbFwiKSB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0Q2hpbGQgPSB0YXJnZXRDaGlsZC4kcGFyZW50TW9kZWw7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBzcGxpdFBhdGgubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmIChnZXRQYXJlbnQgJiYgaSA9PSBzcGxpdFBhdGgubGVuZ3RoIC0gMSkge1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRDaGlsZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRhcmdldENoaWxkID0gdGFyZ2V0Q2hpbGRbc3BsaXRQYXRoW2ldXTtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0Q2hpbGQgPT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IocGF0aFRvT2JqZWN0ICsgXCIgaXMgYW4gaW52YWxpZCBwcm9wZXJ0eSBwYXRoXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0YXJnZXRDaGlsZDtcbiAgICB9XG4gICAgLy8gdGFrZSBhIGJvdW5kICd0cmFuc21pdHRlcicgZWxlbWVudCBhbmQgYWRkIGFuIGV2ZW50IGxpc3RlciB0byB1cGRhdGUgbW9kZWwgb2JqZWN0IGFuZCB0cmFuc21pdCB0byByZWNlaXZlcnNcbiAgICBpbml0aWFsaXplVHJhbnNtaXR0ZXIoYm91bmRFbGVtZW50LCBiaW5kTW9kZSkge1xuICAgICAgICAvLyBBIHRyYW5zbWl0dGVyIHNob3VsZCBhbHdheXMgYmUgYW4gaW5wdXQgZWxlbWVudCBpbiBIVE1MLiBDdXJyZW50bHksIHRoZSBzdXBwb3J0ZWQgZWxlbWV0bnNcbiAgICAgICAgLy8gQXJlIHRleHQsIGRhdGUsIGRhdGV0aW1lLCBjaGVja2VkXG4gICAgICAgIGxldCB0YXJnZXQgPSBib3VuZEVsZW1lbnQudGFyZ2V0O1xuICAgICAgICBsZXQgcHJvcGVydHkgPSBib3VuZEVsZW1lbnQucHJvcGVydHk7XG4gICAgICAgIGxldCB1cGRhdGVWYWx1ZSA9IHRhcmdldFtwcm9wZXJ0eV07XG4gICAgICAgIGlmICghKGJvdW5kRWxlbWVudCBpbnN0YW5jZW9mIEJvdW5kRWxlbWVudCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgYXJndW1lbnQgdG8gaW5pdGlhbGl6ZSB0cmFuc21pdHRlclwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYmluZE1vZGUgPT0gXCJyYWRpb1wiKSB7XG4gICAgICAgICAgICBsZXQgb3B0aW9ucyA9IGJvdW5kRWxlbWVudC5ET01lbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJpbnB1dFwiKTtcbiAgICAgICAgICAgIGZvciAobGV0IG9wdGlvbiBvZiBvcHRpb25zKSB7XG4gICAgICAgICAgICAgICAgaWYgKG9wdGlvbi52YWx1ZSA9PSB1cGRhdGVWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBvcHRpb24uY2hlY2tlZCA9IHRydWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG9wdGlvbi5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBpZiAob3B0aW9uLmNoZWNrZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhcmdldFtwcm9wZXJ0eV0gPSBvcHRpb24udmFsdWU7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIShib3VuZEVsZW1lbnQuRE9NZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgaHRtbCBlbGVtZW50IGJpbmRpbmc6IFwiJHtiaW5kTW9kZX1cIiBtdXN0IGJlIGJvdW5kIHRvIGFuIGlucHV0IGVsZW1lbnRgKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoYm91bmRFbGVtZW50LkRPTWVsZW1lbnQudHlwZSA9PSBcImRhdGVcIikge1xuICAgICAgICAgICAgaWYgKHVwZGF0ZVZhbHVlKSB7XG4gICAgICAgICAgICAgICAgdXBkYXRlVmFsdWUgPSBuZXcgRGF0ZSh1cGRhdGVWYWx1ZSk7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlVmFsdWUgPSB1cGRhdGVWYWx1ZS50b0lTT1N0cmluZygpLnNwbGl0KFwiVFwiKVswXTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2F0Y2ggKGVycikge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiZXJyb3IgY29udmVydGluZyBkYXRlIG9iamVjdFwiLCB1cGRhdGVWYWx1ZSwgZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAoYmluZE1vZGUgPT0gXCJkYXRldGltZS1sb2NhbFwiKSB7XG4gICAgICAgICAgICB1cGRhdGVWYWx1ZSA9IG5ldyBEYXRlKHVwZGF0ZVZhbHVlKTtcbiAgICAgICAgICAgIHVwZGF0ZVZhbHVlID0gdXBkYXRlVmFsdWUuX3RhcmdldE9iamVjdC50b0lTT1N0cmluZygpO1xuICAgICAgICB9XG4gICAgICAgIGJvdW5kRWxlbWVudC5ET01lbGVtZW50LnZhbHVlID0gdXBkYXRlVmFsdWUgfHwgXCJcIjtcbiAgICAgICAgYm91bmRFbGVtZW50LkRPTWVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsICgpID0+IHtcbiAgICAgICAgICAgIGlmIChib3VuZEVsZW1lbnQuRE9NZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQpIHtcbiAgICAgICAgICAgICAgICBsZXQgbm9kZVZhbHVlID0gYm91bmRFbGVtZW50LkRPTWVsZW1lbnQudmFsdWU7XG4gICAgICAgICAgICAgICAgaWYgKGJpbmRNb2RlID09IFwiZGF0ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVWYWx1ZSA9IG5ldyBEYXRlKG5vZGVWYWx1ZSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKGJvdW5kRWxlbWVudC5ET01lbGVtZW50LnR5cGUgPT0gXCJjaGVja2JveFwiKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGVWYWx1ZSA9IGJvdW5kRWxlbWVudC5ET01lbGVtZW50LmNoZWNrZWQ7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRhcmdldFtwcm9wZXJ0eV0gPSBub2RlVmFsdWUgfHwgXCJcIjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuICAgIC8vIEEgJ2ZvcicgYmluZGVyIHJlcGVhdHMgdGhlIHN5bnRheCBpbiB0aGUgY2hpbGRyZW4gZWxlbWVudHMgZm9yIGVhY2ggaXRlbSBpbiB0aGUgZGVmaW5lZCBpdGVyYWJsZVxuICAgIC8vIFRoaXMgZnVuY3Rpb24gbXVzdCBiZSBhYmxlIHRvIGNvbnRyb2wgdGhlIGl0ZW1zIGluIHRoZSBsaXN0IChwdXNoL3BvcCkgYW5kIGNoYW5nZSB0aGVpciB2YWx1ZSBpZiB0aGVcbiAgICAvLyBtb2RlbCBkYXRhIGNoYW5nZXMuXG4gICAgaW5pdGlhbGl6ZUZvcmVhY2goYm91bmRFbGVtZW50KSB7XG4gICAgICAgIC8vIHBhcnNlIHN5bnRheCwgbm90ZSB0aGF0ICdvYmplY3RQYXRoJyByZWZlcnMgdG8gdGhlIGZvcmVhY2ggc3ludGF4IG9mIHRoZSBmb3IgZWxlbWVudFxuICAgICAgICAvLyB3aGljaCBmb2xsb3dzIGZvcmVhY2ggc3ludGF4IChpdGVtIG9mIGxpc3QpXG4gICAgICAgIGxldCB0ZW1wTGlzdCA9IGJvdW5kRWxlbWVudC5vYmplY3RQYXRoLnNwbGl0KFwib2ZcIik7XG4gICAgICAgIGxldCBpdGVyYXRvcktleSA9IHRlbXBMaXN0WzBdLnRyaW0oKTtcbiAgICAgICAgbGV0IGl0ZXJhYmxlT2JqZWN0UGF0aCA9IHRlbXBMaXN0WzFdLnRyaW0oKTtcbiAgICAgICAgbGV0IGl0ZXJhYmxlID0gdGhpcy5yZXR1cm5UYXJnZXRQcm9wZXJ0eShpdGVyYWJsZU9iamVjdFBhdGgpO1xuICAgICAgICBpZiAoYm91bmRFbGVtZW50LkRPTWVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgRm9yIGVsZW1lbnQgbXVzdCBoYXZlIG9ubHkgb25lIGNoaWxkIGF0YCwgYm91bmRFbGVtZW50LkRPTWVsZW1lbnQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGxldCB0ZW1wbGF0ZU5vZGUgPSBib3VuZEVsZW1lbnQuRE9NZWxlbWVudC5yZW1vdmVDaGlsZChib3VuZEVsZW1lbnQuRE9NZWxlbWVudC5jaGlsZHJlblswXSk7XG4gICAgICAgIGlmICghKHRlbXBsYXRlTm9kZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGVtcGxhdGUgbm9kZSBtdXN0IGJlIGluc3RhbmNlIG9mIEhUTUxFbGVtZW50XCIpO1xuICAgICAgICB9XG4gICAgICAgIC8vIFRoZSBjdXJyZW50IGJvdW5kIGVsZW1lbnQgaXMgdGhlICdmb3InIHBhcmVudCBlbGVtZW50IGNvbnRhaW5pbmcgdGhlIGl0ZXJhdGVkIG9iamVjdHNcbiAgICAgICAgLy8gdGhpcyBlbGVtZW50IG5lZWRzIHRvIHN0b3JlIGFsbCBvZiBpdHMgY2hpbGRyZW4sIHRoZSBodG1sIHRlbXBsYXRlIGZvciBjcmVhdGluZyBhIG5ldyBjaGlsZCxcbiAgICAgICAgLy8gYW5kIHRoZSBpdGVyYXRvcmUga2V5IChlZyAnaXRlbScpXG4gICAgICAgIGJvdW5kRWxlbWVudC5vYmplY3RQYXRoID0gaXRlcmFibGVPYmplY3RQYXRoO1xuICAgICAgICBsZXQgb1JlZlBhdGggPSB1dGlscy5wcmVwYXJlT2JqZWN0UGF0aChib3VuZEVsZW1lbnQub2JqZWN0UGF0aCk7XG4gICAgICAgIGJvdW5kRWxlbWVudC50YXJnZXQgPSBpdGVyYWJsZTtcbiAgICAgICAgYm91bmRFbGVtZW50Lm9ic2VydmFibGVDaGlsZHJlbiA9IFtdO1xuICAgICAgICBib3VuZEVsZW1lbnQudGVtcGxhdGVOb2RlID0gdGVtcGxhdGVOb2RlO1xuICAgICAgICBib3VuZEVsZW1lbnQuaXRlcmF0b3JLZXkgPSBpdGVyYXRvcktleTtcbiAgICAgICAgLy8gVGhlIGFwcGxpY2F0aW9uIHNob3VsZCBlbmZvcmNlIHRoYXQgdGhlIGJvdW5kRWxlbWVudCBvbmx5IGhhcyBvbmUgcm9vdCAodGhlIGl0ZXJhdG9yIHRlbXBsYXRlKVxuICAgICAgICAvLyBUaGVuLCBpdCBzaG91bGQgY2xvbmUgdGhhdCBpdGVtIGFuZCBhcHBlbmQgaXQgaXRlcmFibGUubGVuZ3RoIC0gMSB0aW1lc1xuICAgICAgICAvLyBUaGUgcGFyZW50IG9iamVjdCAoY3VyZW50IGJvdW5kRWxlbWVudCkgbmVlZHMgdG8gYmUgYWRkZWQgdG8gdGhlIGJvdW5kIGVsZW1lbnRzIGFycmF5XG4gICAgICAgIC8vIHByb2JsZW0gbm90ZWQ6IHdoZW4gdGhlIE9ic2VydmFibGVPYmplY3QgaW5zdGFudGlhdGVzLCBpdCBjb3BpZXMgdGhlIG9iamVjdCBwYXJhbWV0ZXIsIG1lYW5pbmcgdGhhdCBzY29wZWQgc3ViIG1vZGVsc1xuICAgICAgICAvLyBEbyBub3QgcmVmbGVjdCBjaGFuZ2VzIHRvIHRoZSBvYmplY3QgbW9kZWwgdGhleSBhcmUgZGVzY2VuZGVudCBmcm9tXG4gICAgICAgIGxldCBpbmRleCA9IDA7XG4gICAgICAgIGlmICghQXJyYXkuaXNBcnJheShpdGVyYWJsZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJ0ZvcicgZWxlbWVudCBtdWNoIGJpbmQgdG8gYW4gaXRlcmFibGUgYXQgJHtib3VuZEVsZW1lbnQuRE9NZWxlbWVudH1gKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIGl0ZXJhYmxlKSB7XG4gICAgICAgICAgICAvLyBDcmVhdGUgY2xvbmUgb2YgdGVtcGxhdGUgbm9kZSBmb3IgZWFjaCBib3VuZCBlbGVtZW50XG4gICAgICAgICAgICBsZXQgY2xvbmUgPSB0ZW1wbGF0ZU5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgYm91bmRFbGVtZW50LkRPTWVsZW1lbnQuYXBwZW5kQ2hpbGQoY2xvbmUpO1xuICAgICAgICAgICAgLy8gYSAnZm9yJyBlbGVtZW50IGNyZWF0ZXMgaXRzIG93biBhdXRvbm9tb3VzIG1vZGVsIHNjb3BlIHdpdGggdGhlICdpdGVtJyBiZWluZyBhIG5ldyBvYnNlcnZhYmxlIG9iamVjdCBpbnNlcnRlZCBpbnRvXG4gICAgICAgICAgICAvLyBhIHN1YiBtb2RlbFxuICAgICAgICAgICAgbGV0IHN1Yk1vZGVsID0ge307XG4gICAgICAgICAgICBsZXQgbmV3T2JqID0gbmV3IE9ic2VydmFibGVPYmplY3QoaXRlbSwgdGhpcyk7XG4gICAgICAgICAgICBzdWJNb2RlbFtpdGVyYXRvcktleV0gPSBuZXdPYmouZGF0YU9iamVjdFByb3h5O1xuICAgICAgICAgICAgc3ViTW9kZWwuJHBhcmVudE1vZGVsID0gdGhpcy4kbW9kZWw7XG4gICAgICAgICAgICBuZXdPYmouJG1vZGVsID0gc3ViTW9kZWw7XG4gICAgICAgICAgICBpZiAoIShjbG9uZSBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgJ2ZvcicgYmluZGluZyB0ZW1wbGF0ZSBub2RlIG11c3QgYmUgYW4gaW5zdGFuY2Ugb2YgSFRNTEVsZW1lbnQgYXQgJHtjbG9uZX1gKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIFBhcnNlRE9NZm9yT2JzZXJ2YWJsZXMoc3ViTW9kZWwsIGNsb25lKTtcbiAgICAgICAgICAgIHZhciBzdWJNb2RlbENvbnRleHQgPSB7XG4gICAgICAgICAgICAgICAgc3ViTW9kZWw6IHN1Yk1vZGVsLFxuICAgICAgICAgICAgICAgIG5vZGU6IGNsb25lLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIGJvdW5kRWxlbWVudC5vYnNlcnZhYmxlQ2hpbGRyZW4ucHVzaChzdWJNb2RlbENvbnRleHQpO1xuICAgICAgICAgICAgLy8gcmVwbGFjZSBhcnJheSBpdGVtIHdpdGggaXRzIG9ic2VydmFibGUgdmVyc2lvblxuICAgICAgICAgICAgaXRlcmFibGVbaW5kZXgrK10gPSBuZXdPYmouZGF0YU9iamVjdFByb3h5O1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZm9yRWFjaENvbXBvbmVudHMucHVzaChib3VuZEVsZW1lbnQpO1xuICAgIH1cbiAgICB1cGRhdGVBcnJheU9uU2V0KHRhcmdldEFyciwgdGFyZ2V0UHJvcGVydHksIHZhbHVlKSB7XG4gICAgICAgIC8vIGxvY2F0ZSBhcHByb3ByaWF0ZSBhcnJheSBvZiBib3VuZCBlbGVtZW50cyBpbiBmb3JFYWNoQ29tcG9uZW50cyAodGhpcyBzaG91bGQgYmUgYSAnZm9yJyBlbGVtZW50KVxuICAgICAgICAvLyB0YXJnZXRBcnIgaXMgYW4gYXJyYXkgcGFydCBvZiB0aGUgb2JqIGFyZ3VtZW50IHRvIG9ic2VydmFibGUgb2JqZWN0LCB0aGlzIGZ1bmN0aW9uIGlzIGNhbGxlZCB3aGVuIHVwZGF0aW5nXG4gICAgICAgIC8vIGl0cyBQcm94eSBvYmplY3QuXG4gICAgICAgIHZhciBib3VuZEVsZW1lbnQ7XG4gICAgICAgIC8vIEZpbmQgdGhlIGNvcnJlY3QgQm91bmRFbGVtZW50IGluIHRoZSBsaXN0IG9mICdmb3JFYWNoQ29tcG9uZW50cycsXG4gICAgICAgIC8vIHdoaWNoIHJlcHJlc2VudCBhbGwgYXJyYXlzIGluc2lkZSBvZiB0aGUgT2JzZXJ2YWJsZU9iamVjdFxuICAgICAgICAvLyB0aGF0IGhhdmUgYmVlbiBib3VuZCB0byBhIGZvciBiaW5kaW5nIGluIHRoZSBET00uXG4gICAgICAgIGZvciAobGV0IGl0ZW0gb2YgdGhpcy5mb3JFYWNoQ29tcG9uZW50cykge1xuICAgICAgICAgICAgaWYgKGl0ZW0udGFyZ2V0Ll90YXJnZXRPYmplY3QgPT0gdGFyZ2V0QXJyKSB7XG4gICAgICAgICAgICAgICAgYm91bmRFbGVtZW50ID0gaXRlbTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBpZiAodGFyZ2V0UHJvcGVydHkgPT0gXCJsZW5ndGhcIikge1xuICAgICAgICAgICAgdGFyZ2V0QXJyW3RhcmdldFByb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgaWYgKGJvdW5kRWxlbWVudCkge1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC5vYnNlcnZhYmxlQ2hpbGRyZW4ubGVuZ3RoID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgd2hpbGUgKGJvdW5kRWxlbWVudC5ET01lbGVtZW50LmNoaWxkcmVuLmxlbmd0aCA+IHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC5ET01lbGVtZW50Lmxhc3RDaGlsZC5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiB0YXJnZXRQcm9wZXJ0eSA9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICB0YXJnZXRQcm9wZXJ0eSA9IE51bWJlci5wYXJzZUludCh0YXJnZXRQcm9wZXJ0eSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gUHJlc2VuY2Ugb2YgYm91bmRFbGVtZW50IG1lYW5zIHRoYXQgdGhpcyBhcnJheSBpcyBib3VuZCB0byBhIERPTSBlbGVtZW50XG4gICAgICAgIGlmIChib3VuZEVsZW1lbnQpIHtcbiAgICAgICAgICAgIGxldCBpbnNlcnROb2RlO1xuICAgICAgICAgICAgLy8gY29uc3RydWN0IG5ldyBjaGlsZCBub2RlXG4gICAgICAgICAgICBpbnNlcnROb2RlID0gYm91bmRFbGVtZW50LnRlbXBsYXRlTm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBpZiAoIShpbnNlcnROb2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUZW1wbGF0ZSBub2RlIGlzIG5vdCBvZiB0eXBlIEhUTUxFbGVtZW50YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgc3ViTW9kZWwgPSB7fTtcbiAgICAgICAgICAgIC8vIElmIHZhbHVlIGJlaW5nIHNldCBpcyBub3QgYW4gb2JzZXJ2YWJsZSBvYmplY3RcbiAgICAgICAgICAgIGlmICghdmFsdWUuX29ic2VydmFibGVPYmplY3QpIHtcbiAgICAgICAgICAgICAgICAvLyBjcmVhdCBzdWJNb2RlbCBmb3IgY2hpbGQgbm9kZSBvYnNlcnZhYmxlIHNjb3BlIGFuZCBhZGQgdGhlIG9ic2VydmFibGUgdG8gdGhlIGFycmF5XG4gICAgICAgICAgICAgICAgdmFsdWUgPSBuZXcgT2JzZXJ2YWJsZU9iamVjdCh2YWx1ZSkuZGF0YU9iamVjdFByb3h5O1xuICAgICAgICAgICAgICAgIHN1Yk1vZGVsW2JvdW5kRWxlbWVudC5pdGVyYXRvcktleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB2YWx1ZS5fb2JzZXJ2YWJsZU9iamVjdC4kbW9kZWwgPSBzdWJNb2RlbDtcbiAgICAgICAgICAgICAgICBzdWJNb2RlbC4kcGFyZW50TW9kZWwgPSB0aGlzLiRtb2RlbDtcbiAgICAgICAgICAgICAgICAvLyBDcmVhdGUgc3VibW9kZWwgY29udGV4dCB0aGF0IHN0b3JlcyBub2RlLWVsZW1lbnQgcGFpcmluZ1xuICAgICAgICAgICAgICAgIGxldCBzdWJNb2RlbENvbnRleHQgPSB7XG4gICAgICAgICAgICAgICAgICAgIHN1Yk1vZGVsOiBzdWJNb2RlbCxcbiAgICAgICAgICAgICAgICAgICAgbm9kZTogaW5zZXJ0Tm9kZSxcbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC5vYnNlcnZhYmxlQ2hpbGRyZW5bdGFyZ2V0UHJvcGVydHldID0gc3ViTW9kZWxDb250ZXh0O1xuICAgICAgICAgICAgICAgIFBhcnNlRE9NZm9yT2JzZXJ2YWJsZXMoc3ViTW9kZWwsIGluc2VydE5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gdGhpcyBtYWtlcyBhc3N1bXB0aW9uIHRoYXQgaWYgaXQgaXMgTk9UIGFuIG9ic2VydmFibGUgb2JqZWN0LCBpdCBpcyBhbiBleGlzdGluZyBpdGVtIGluIHRoZSBhcnJheS5cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIExvY2F0ZSB0aGUgb2JzZXJ2YWJsZSBjaGlsZCBvZiB0aGUgYm91bmQgJ2ZvcicgZWxlbWVudCB3aGVyZVxuICAgICAgICAgICAgICAgIC8vIHRoZSBvYnNlcnZhYmxlIG9iamVjdCBhdCBvYnNlcnZhYmxlQ2hpbGQuc3ViTW9kZWxbaXRlcmF0b3JLZXldXG4gICAgICAgICAgICAgICAgLy8gZXF1YWxzIHRoZSB2YWx1ZSBwYXJhbWV0ZXIgb2YgdGhpcyBmdW5jdGlvblxuICAgICAgICAgICAgICAgIC8vIFJlbWluZGVyOiAnaXRlcmF0b3JLZXknIGlzIHdoYXRldmVyIHRoZSBET00gZWxlbWVudCBkZWNsYXJlcyBhIDxpdGVtPiBpbiB0aGUgZm9yZWFjaCBiaW5kXG4gICAgICAgICAgICAgICAgbGV0IGl0ZXJhdG9yS2V5ID0gYm91bmRFbGVtZW50Lml0ZXJhdG9yS2V5O1xuICAgICAgICAgICAgICAgIGxldCBvYnNlcnZhYmxlQ2hpbGQgPSBib3VuZEVsZW1lbnQub2JzZXJ2YWJsZUNoaWxkcmVuLmZpbmQoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGl0ZW0uc3ViTW9kZWxbaXRlcmF0b3JLZXldID09IHZhbHVlO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIC8vIGlmIHRoZSBpbnNlcnRlZCBvYmplY3QgaXMgYW4gb2JzZXJ2YWJsZSwgYnV0IGlzIG5vdCBjdXJyZW50bHkgaW4gdGhlIGJvdW5kIGFycmF5XG4gICAgICAgICAgICAgICAgaWYgKCFvYnNlcnZhYmxlQ2hpbGQpIHtcbiAgICAgICAgICAgICAgICAgICAgc3ViTW9kZWxbYm91bmRFbGVtZW50Lml0ZXJhdG9yS2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZS5fb2JzZXJ2YWJsZU9iamVjdC4kbW9kZWwgPSBzdWJNb2RlbDtcbiAgICAgICAgICAgICAgICAgICAgc3ViTW9kZWwuJHBhcmVudE1vZGVsID0gdGhpcy4kbW9kZWw7XG4gICAgICAgICAgICAgICAgICAgIC8vIENyZWF0ZSBzdWJtb2RlbCBjb250ZXh0IHRoYXQgc3RvcmVzIG5vZGUtZWxlbWVudCBwYWlyaW5nXG4gICAgICAgICAgICAgICAgICAgIGxldCBzdWJNb2RlbENvbnRleHQgPSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBzdWJNb2RlbDogc3ViTW9kZWwsXG4gICAgICAgICAgICAgICAgICAgICAgICBub2RlOiBpbnNlcnROb2RlLFxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQub2JzZXJ2YWJsZUNoaWxkcmVuW3RhcmdldFByb3BlcnR5XSA9IHN1Yk1vZGVsQ29udGV4dDtcbiAgICAgICAgICAgICAgICAgICAgUGFyc2VET01mb3JPYnNlcnZhYmxlcyhzdWJNb2RlbCwgaW5zZXJ0Tm9kZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQub2JzZXJ2YWJsZUNoaWxkcmVuW3RhcmdldFByb3BlcnR5XSA9IG9ic2VydmFibGVDaGlsZDtcbiAgICAgICAgICAgICAgICAgICAgLy8gUmVtaW5kZXI6ICdvYnNlcnZhYmxlQ2hpbGQnIHJlZmVycyB0byBhIHN1Yk1vZGVsQ29udGV4dCBjb250YWluaW5nIGEgc3VibW9kZWwgYW5kIGEgaHRtbCBub2RlXG4gICAgICAgICAgICAgICAgICAgIFBhcnNlRE9NZm9yT2JzZXJ2YWJsZXMob2JzZXJ2YWJsZUNoaWxkLnN1Yk1vZGVsLCBpbnNlcnROb2RlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBJbnNlcnQgbm9kZSBpbiBhcHByb3ByaWF0ZSBpbmRleCBwb3NpdGlvblxuICAgICAgICAgICAgLy8gR2V0IGN1cnJlbnQgbm9kZSBhdCB0aGF0IHBvc2l0aW9uXG4gICAgICAgICAgICBsZXQgY3VycmVudEluZGV4ID0gYm91bmRFbGVtZW50LkRPTWVsZW1lbnQuY2hpbGRyZW5bdGFyZ2V0UHJvcGVydHldO1xuICAgICAgICAgICAgaWYgKE51bWJlcih0YXJnZXRQcm9wZXJ0eSkgPT0gYm91bmRFbGVtZW50LkRPTWVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgYm91bmRFbGVtZW50LkRPTWVsZW1lbnQuYXBwZW5kQ2hpbGQoaW5zZXJ0Tm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQuRE9NZWxlbWVudC5yZXBsYWNlQ2hpbGQoaW5zZXJ0Tm9kZSwgY3VycmVudEluZGV4KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBwdXNoIHRoZSBvYmplY3QgdG8gdGhlIHRoZSBkYXRhIG9iamVjdCBwcm94eSBhcnJheVxuICAgICAgICB0YXJnZXRBcnJbdGFyZ2V0UHJvcGVydHldID0gdmFsdWU7XG4gICAgfVxuICAgIHVwZGF0ZUFycmF5T25EZWxldGUodGFyZ2V0QXJyLCB0YXJnZXRQcm9wZXJ0eSkge1xuICAgICAgICBsZXQgYm91bmRFbGVtZW50O1xuICAgICAgICBpZiAodHlwZW9mIHRhcmdldFByb3BlcnR5ID09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgIGlmIChOdW1iZXIucGFyc2VJbnQodGFyZ2V0UHJvcGVydHkpID09IE5hTikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkFycmF5IGluZGV4IG11c3QgYmUgYW4gaW50ZWdlciB2YWx1ZVwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBpdGVtIG9mIHRoaXMuZm9yRWFjaENvbXBvbmVudHMpIHtcbiAgICAgICAgICAgIGlmIChpdGVtLnRhcmdldC5fdGFyZ2V0T2JqZWN0ID09IHRhcmdldEFycikge1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudCA9IGl0ZW07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiB0YXJnZXRQcm9wZXJ0eSA9PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICB0YXJnZXRQcm9wZXJ0eSA9IE51bWJlci5wYXJzZUludCh0YXJnZXRQcm9wZXJ0eSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gUHJlc2VuY2Ugb2YgYm91bmRFbGVtZW50IG1lYW5zIHRoYXQgdGhpcyBhcnJheSBpcyBib3VuZCB0byBhIERPTSBlbGVtZW50XG4gICAgICAgIGlmIChib3VuZEVsZW1lbnQpIHtcbiAgICAgICAgICAgIC8vIGZpbmQgdGhlIG5vZGUgaW4gdGhlIGZvciBlbGVtZW50IHRvIGRlbGV0ZSBhbmQgZGVsZXRlIGl0IGZyb20gRE9NXG4gICAgICAgICAgICBsZXQgY3VycmVudEluZGV4ID0gYm91bmRFbGVtZW50LkRPTWVsZW1lbnQuY2hpbGRyZW5bdGFyZ2V0UHJvcGVydHldO1xuICAgICAgICAgICAgYm91bmRFbGVtZW50LkRPTWVsZW1lbnQucmVtb3ZlQ2hpbGQoY3VycmVudEluZGV4KTtcbiAgICAgICAgICAgIC8vIHJlbW92ZSBlbGVtZW50IGZyb20gb2JzZXJ2YWJsZSBjaGlsZHJlbiB0byBtYWludGFpbiBwYXJpdHkgYmV0d2VlbiB0aGF0IGxpc3QgYW5kIHRoZSB0YXJnZXRBcnJcbiAgICAgICAgICAgIGRlbGV0ZSBib3VuZEVsZW1lbnQub2JzZXJ2YWJsZUNoaWxkcmVuW3RhcmdldFByb3BlcnR5XTtcbiAgICAgICAgfVxuICAgICAgICAvLyBGaW5hbGx5LCBkZWxldGUgZWxlbWVudCBpbiB0YXJnZXRBcnJcbiAgICAgICAgZGVsZXRlIHRhcmdldEFyclt0YXJnZXRQcm9wZXJ0eV07XG4gICAgfVxuICAgIC8vIGZ1bmN0aW9uIHRvIHJlZ2lzdGVyIGFuIGVsZW1lbnQsIHBlcmZvcm0gYW55IGludGlhbGl6YXRpb24sYSBuZCBhZGQgdG8gYXBwcm9wcmlhdGUgYXJyYXlcbiAgICByZWdpc3RlckVsZW1lbnQoYmluZE1vZGUsIGJvdW5kRWxlbWVudCkge1xuICAgICAgICBsZXQgb2JqZWN0UGF0aDtcbiAgICAgICAgdmFyIGNhbGxCYWNrUGF0aDtcbiAgICAgICAgdmFyIGF0dHI7XG4gICAgICAgIHZhciBiaW5kaW5nO1xuICAgICAgICB2YXIgdGFyZ2V0UGF0aDtcbiAgICAgICAgc3dpdGNoIChiaW5kTW9kZSkge1xuICAgICAgICAgICAgY2FzZSBcInRleHRcIjpcbiAgICAgICAgICAgIGNhc2UgXCJjaGVja2VkXCI6XG4gICAgICAgICAgICBjYXNlIFwicmFkaW9cIjpcbiAgICAgICAgICAgIGNhc2UgXCJkYXRlXCI6XG4gICAgICAgICAgICAgICAgdGhpcy50cmFuc21pdHRlcnMucHVzaChib3VuZEVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGxldCBvUmVmUGF0aCA9IHV0aWxzLnByZXBhcmVPYmplY3RQYXRoKGJvdW5kRWxlbWVudC5vYmplY3RQYXRoKTtcbiAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQudGFyZ2V0ID0gdXRpbHMucmV0dXJuVGFyZ2V0UHJvcGVydHkodGhpcy5kYXRhT2JqZWN0UHJveHksIG9SZWZQYXRoLCB0cnVlKTtcbiAgICAgICAgICAgICAgICB2YXIgc3BsaXRQYXRoID0gYm91bmRFbGVtZW50Lm9iamVjdFBhdGguc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC5wcm9wZXJ0eSA9IHNwbGl0UGF0aFtzcGxpdFBhdGgubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgdGhpcy5pbml0aWFsaXplVHJhbnNtaXR0ZXIoYm91bmRFbGVtZW50LCBiaW5kTW9kZSk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiZm9ybWF0XCI6XG4gICAgICAgICAgICAgICAgLy8gZm9ybWF0IGJpbmRzIGhhdmUgc3ludGF4IFwiZm9ybWF0OiBvYmplY3RQYXRofGNhbGxiYWNrRnVuY3Rpb25cIlxuICAgICAgICAgICAgICAgIFtvYmplY3RQYXRoLCBjYWxsQmFja1BhdGhdID0gYm91bmRFbGVtZW50Lm9iamVjdFBhdGguc3BsaXQoXCJ8XCIpO1xuICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC51cGRhdGVDYWxsYmFjayA9IHV0aWxzLnJldHVyblRhcmdldFByb3BlcnR5KHRoaXMuZGF0YU9iamVjdFByb3h5LCBjYWxsQmFja1BhdGgpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZXJyLm1lc3NhZ2UpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQub2JqZWN0UGF0aCA9IG9iamVjdFBhdGg7XG4gICAgICAgICAgICBjYXNlIFwidmFsdWVcIjpcbiAgICAgICAgICAgICAgICB0YXJnZXRQYXRoID0gdXRpbHMucHJlcGFyZU9iamVjdFBhdGgoYm91bmRFbGVtZW50Lm9iamVjdFBhdGgpO1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC50YXJnZXQgPSB1dGlscy5yZXR1cm5UYXJnZXRQcm9wZXJ0eSh0aGlzLmRhdGFPYmplY3RQcm94eSwgdGFyZ2V0UGF0aCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgc3BsaXRQYXRoID0gYm91bmRFbGVtZW50Lm9iamVjdFBhdGguc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC5wcm9wZXJ0eSA9IHNwbGl0UGF0aFtzcGxpdFBhdGgubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNlaXZlcnMucHVzaChib3VuZEVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC51cGRhdGUoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJhdHRyXCI6XG4gICAgICAgICAgICAgICAgLy8gYXR0ciBiaW5kaW5ncyBmb2xsb3cgc3ludGF4IFwiYXR0cjogdGFyZ2V0QXR0cnxiaW5kaW5nXCJcbiAgICAgICAgICAgICAgICBbYXR0ciwgYmluZGluZywgY2FsbEJhY2tQYXRoXSA9IGJvdW5kRWxlbWVudC5vYmplY3RQYXRoLnNwbGl0KFwifFwiKTtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbEJhY2tQYXRoKSB7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQudXBkYXRlQ2FsbGJhY2sgPSB1dGlscy5yZXR1cm5UYXJnZXRQcm9wZXJ0eSh0aGlzLmRhdGFPYmplY3RQcm94eSwgY2FsbEJhY2tQYXRoKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVyci5tZXNzYWdlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQub2JqZWN0UGF0aCA9IGJpbmRpbmc7XG4gICAgICAgICAgICAgICAgc3BsaXRQYXRoID0gYm91bmRFbGVtZW50Lm9iamVjdFBhdGguc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC5wcm9wZXJ0eSA9IHNwbGl0UGF0aFtzcGxpdFBhdGgubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgdGFyZ2V0UGF0aCA9IHV0aWxzLnByZXBhcmVPYmplY3RQYXRoKGJvdW5kRWxlbWVudC5vYmplY3RQYXRoKTtcbiAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQudGFyZ2V0ID0gdXRpbHMucmV0dXJuVGFyZ2V0UHJvcGVydHkodGhpcy5kYXRhT2JqZWN0UHJveHksIHRhcmdldFBhdGgsIHRydWUpO1xuICAgICAgICAgICAgICAgIHNwbGl0UGF0aCA9IGJvdW5kRWxlbWVudC5vYmplY3RQYXRoLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlY2VpdmVycy5wdXNoKGJvdW5kRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgYm91bmRFbGVtZW50LmF0dHIgPSBhdHRyO1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC51cGRhdGUoKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGNhc2UgXCJmb3JcIjpcbiAgICAgICAgICAgICAgICB0aGlzLmluaXRpYWxpemVGb3JlYWNoKGJvdW5kRWxlbWVudCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBjYXNlIFwiaGlkZGVuXCI6XG4gICAgICAgICAgICAgICAgdGFyZ2V0UGF0aCA9IHV0aWxzLnByZXBhcmVPYmplY3RQYXRoKGJvdW5kRWxlbWVudC5vYmplY3RQYXRoKTtcbiAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQudGFyZ2V0ID0gdXRpbHMucmV0dXJuVGFyZ2V0UHJvcGVydHkodGhpcy5kYXRhT2JqZWN0UHJveHksIHRhcmdldFBhdGgsIHRydWUpO1xuICAgICAgICAgICAgICAgIHNwbGl0UGF0aCA9IGJvdW5kRWxlbWVudC5vYmplY3RQYXRoLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQucHJvcGVydHkgPSBzcGxpdFBhdGhbc3BsaXRQYXRoLmxlbmd0aCAtIDFdO1xuICAgICAgICAgICAgICAgIHRoaXMucmVjZWl2ZXJzLnB1c2goYm91bmRFbGVtZW50KTtcbiAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQudXBkYXRlID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICBib3VuZEVsZW1lbnQuRE9NZWxlbWVudC5oaWRkZW4gPVxuICAgICAgICAgICAgICAgICAgICAgICAgYm91bmRFbGVtZW50LnRhcmdldFtib3VuZEVsZW1lbnQucHJvcGVydHldO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYm91bmRFbGVtZW50LnVwZGF0ZSgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgY2FzZSBcInZpc2libGVcIjpcbiAgICAgICAgICAgICAgICB0YXJnZXRQYXRoID0gdXRpbHMucHJlcGFyZU9iamVjdFBhdGgoYm91bmRFbGVtZW50Lm9iamVjdFBhdGgpO1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC50YXJnZXQgPSB1dGlscy5yZXR1cm5UYXJnZXRQcm9wZXJ0eSh0aGlzLmRhdGFPYmplY3RQcm94eSwgdGFyZ2V0UGF0aCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgc3BsaXRQYXRoID0gYm91bmRFbGVtZW50Lm9iamVjdFBhdGguc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC5wcm9wZXJ0eSA9IHNwbGl0UGF0aFtzcGxpdFBhdGgubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgdGhpcy5yZWNlaXZlcnMucHVzaChib3VuZEVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC51cGRhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgIGJvdW5kRWxlbWVudC5ET01lbGVtZW50LmhpZGRlbiA9XG4gICAgICAgICAgICAgICAgICAgICAgICAhYm91bmRFbGVtZW50LnRhcmdldFtib3VuZEVsZW1lbnQucHJvcGVydHldO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICAgICAgYm91bmRFbGVtZW50LnVwZGF0ZSgpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxufVxuZXhwb3J0IGZ1bmN0aW9uIG1ha2VPYnNlcnZhYmxlKG9iaiwgcGFyZW50KSB7XG4gICAgdmFyIG9ic2VydmFibGUgPSBuZXcgT2JzZXJ2YWJsZU9iamVjdChvYmopO1xuICAgIHJldHVybiBvYnNlcnZhYmxlLmdldFByb3h5KCk7XG59XG4iLCJleHBvcnQgeyBCb3VuZEVsZW1lbnQsIHV0aWxzLCB6ayB9O1xuaW1wb3J0IHsgbWFrZU9ic2VydmFibGUgfSBmcm9tIFwiLi9PYnNlcnZhYmxlT2JqZWN0XCI7XG5jb25zdCB6ayA9IHtcbiAgICByb290X21vZGVsOiB7fSxcbiAgICBtYWtlT2JzZXJ2YWJsZTogbWFrZU9ic2VydmFibGUsXG4gICAgaW5pdGlhdGVNb2RlbDogaW5pdGlhdGVNb2RlbCxcbn07XG4vLyBGdW5jdGlvbiB0byBpbml0aWF0ZSBhbnkgb2JqZWN0IHZhcmlhYmxlcyBhY2Nlc3NpYmxlIHRvIGFsbCB6ayBvYmplY3RzXG4vLyBUaGVuIGJlZ2luIHJlY3Vyc2l2ZWx5IHBhcnNpbmcgRE9NIGZvciBvYnNlcnZhYmxlIGVsZW1lbnRzXG4vLyBQYXJhbWV0ZXJzXG4vLyBNb2RlbDogYW4gb2JqZWN0IGNvbnRhaW5pbmcgb2JzZXJ2YWJsZSBvYmplY3RzXG4vLyBSb290OiBBbiBodG1sIG5vZGUgdGhhdCBpcyB0aGUgcm9vdCBlbGVtZW50IG9mIGFsbCBvYnNlcnZhYmxlIG9iamVjdHNcbmZ1bmN0aW9uIGluaXRpYXRlTW9kZWwobW9kZWwsIHJvb3QpIHtcbiAgICBmb3IgKGxldCBvYmplY3QgaW4gbW9kZWwpIHtcbiAgICAgICAgaWYgKCFtb2RlbFtvYmplY3RdKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobW9kZWxbb2JqZWN0XS5fb2JzZXJ2YWJsZU9iamVjdCkge1xuICAgICAgICAgICAgbW9kZWxbb2JqZWN0XS5fb2JzZXJ2YWJsZU9iamVjdC4kbW9kZWwgPSBtb2RlbDtcbiAgICAgICAgfVxuICAgIH1cbiAgICBpZiAoIShyb290IGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkludmFsaWQgYXJndW1lbnQ6IHNlY29uZCBwYXJhbWV0ZXIgbXVzdCBiZSBhbiBIVE1MIGVsZW1lbnRcIik7XG4gICAgfVxuICAgIFBhcnNlRE9NZm9yT2JzZXJ2YWJsZXMobW9kZWwsIHJvb3QpO1xufVxuLy8gUmVjdXJzaXZlIGZ1bmN0aW9uIHRoYXQgbG9jYXRlcyBhbmQgcmVnaXN0ZXJzIGFueSBodG1sIGVsZW1lbnQgZGVzY2VuZGluZyBmcm9tIHJvb3QgdGhhdCBzaG91bGQgYmUgb2JzZXJ2ZWRcbmV4cG9ydCBmdW5jdGlvbiBQYXJzZURPTWZvck9ic2VydmFibGVzKG1vZGVsLCByb290KSB7XG4gICAgdmFyIGlzSW5kZXBlbmRlbnRFbGVtZW50ID0gZmFsc2U7XG4gICAgLy8gaWYgSFRNTCBlbGVtZW50IGNvbnRhaW5zIGJpbmRlclxuICAgIGlmIChyb290LmdldEF0dHJpYnV0ZShcInprLWJpbmRcIikpIHtcbiAgICAgICAgLy8gcGFyc2UgdGhlIGJpbmQgY29tbWFuZFxuICAgICAgICAvLyBiaW5kIHN5bnRheCBpcyAnPGJpbmRNb2RlPjogPG9iamVjdCBwYXRoJ1xuICAgICAgICBjb25zdCB6a2JpbmQgPSByb290LmdldEF0dHJpYnV0ZShcInprLWJpbmRcIik7XG4gICAgICAgIHZhciBiaW5kaW5nRXhwcmVzc2lvbnMgPSBbXTtcbiAgICAgICAgaWYgKHprYmluZCkge1xuICAgICAgICAgICAgYmluZGluZ0V4cHJlc3Npb25zID0gemtiaW5kLnNwbGl0KFwiO1wiKTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBiaW5kZXIgb2YgYmluZGluZ0V4cHJlc3Npb25zKSB7XG4gICAgICAgICAgICBjb25zdCBzcGxpdEJpbmRlciA9IGJpbmRlci5zcGxpdChcIjpcIik7XG4gICAgICAgICAgICBpZiAoc3BsaXRCaW5kZXIubGVuZ3RoIDwgMikge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBiaW5kaW5nIGF0OiAke3Jvb3R9YCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBpc29sYXRlIGJpbmRNb2RlIHN0cmluZyBhbmQgb2JqZWN0IHBhdGggKGdldHRpbmcgcmlkIG9mIHByZWNlZGluZyB3aGl0ZSBzcGFjZSlcbiAgICAgICAgICAgIGNvbnN0IGJpbmRNb2RlID0gc3BsaXRCaW5kZXJbMF07XG4gICAgICAgICAgICBjb25zdCBvYmplY3RQYXRoID0gc3BsaXRCaW5kZXJbMV0udHJpbSgpO1xuICAgICAgICAgICAgLy8gQ3VycmVudCBhcnJheSBvZiB2YWxpZCBiaW5kIG1vZGVzIGZvciB2YWxpZGl0eSBjaGVja2luZ1xuICAgICAgICAgICAgY29uc3QgdmFsaWRCaW5kTW9kZXMgPSBbXG4gICAgICAgICAgICAgICAgXCJ0ZXh0XCIsXG4gICAgICAgICAgICAgICAgXCJ2YWx1ZVwiLFxuICAgICAgICAgICAgICAgIFwiZm9yXCIsXG4gICAgICAgICAgICAgICAgXCJkYXRlXCIsXG4gICAgICAgICAgICAgICAgXCJvblwiLFxuICAgICAgICAgICAgICAgIFwiZm9ybWF0XCIsXG4gICAgICAgICAgICAgICAgXCJjaGVja2JveFwiLFxuICAgICAgICAgICAgICAgIFwiYXR0clwiLFxuICAgICAgICAgICAgICAgIFwiaGlkZGVuXCIsXG4gICAgICAgICAgICAgICAgXCJ2aXNpYmxlXCIsXG4gICAgICAgICAgICAgICAgXCJyYWRpb1wiLFxuICAgICAgICAgICAgXTtcbiAgICAgICAgICAgIC8vIFZlcmlmeSB0aGF0IGJpbmQgbW9kZSBpcyB2YWxpZFxuICAgICAgICAgICAgaWYgKCF2YWxpZEJpbmRNb2Rlcy5pbmNsdWRlcyhiaW5kTW9kZSkpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGJpbmRNb2RlICsgXCIgaXMgbm90IGEgdmFsaWQgYmluZCBtb2RlXCIpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gUGFyZW50IG9iamVjdCBpbiBwYXRoIGlzIGV4cGVjdGVkIHRvIGJlIGFuIGF0dHJpYnV0ZSBvZiB0aGUgbW9kZWwgcGFyYW1ldGVyIG9mIHRoaXMgZnVuY3Rpb25cbiAgICAgICAgICAgIC8vIFBhcnNlIHBhcmVudCBvYmplY3QsIGFuZCBhZGQgdGhpcyBlbGVtZW50IHRvIHRoZSBhcHByb3ByaWF0ZSBsaXN0XG4gICAgICAgICAgICBsZXQgcGFyZW50T2JqZWN0ID0gb2JqZWN0UGF0aC5zcGxpdChcIi5cIilbMF07XG4gICAgICAgICAgICAvLyBBIGxpdHRsZSBtZXNzeSwgYnV0ICdmb3InIGJpbmRlcnMgcmVjZWl2ZSBhbiBhcmd1bWVudCBvZiAnaW5kZXhLZXkgb2YgaXRlcmFibGUnIHdoZXJlXG4gICAgICAgICAgICAvLyBpdGVyYWJsZSBpcyB0aGUgdHlwaWNhbCBvYmplY3RwYXR5LlxuICAgICAgICAgICAgaWYgKGJpbmRNb2RlID09PSBcImZvclwiKSB7XG4gICAgICAgICAgICAgICAgcGFyZW50T2JqZWN0ID0gb2JqZWN0UGF0aC5zcGxpdChcIm9mXCIpWzFdLnRyaW0oKS5zcGxpdChcIi5cIilbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBQdXNoIHRoZSBlbGVtZW50IHRvIHRoZSBhcHByb3ByaWF0ZSBsaXN0XG4gICAgICAgICAgICAvLyBQbGFjZWhvbGRlciBmb3IgYmluZG1vZGUgdW50aWwgcGFyc2luZyBvY2NlcnMuXG4gICAgICAgICAgICAvLyBUT0RPOiBtYWtlIHJlZ2lzdGVyIGVsZW1lbnQgcGFzcyBwYXJzaW5nIHRvIGJvdW5kIGVsZW1lbnQgcmF0aGVyIHRoYW4gZG8gaXQgb24gdGhlIG9iamVjdCBpdHNlbGYuXG4gICAgICAgICAgICBjb25zdCBib3VuZEVsZW1lbnQgPSBuZXcgQm91bmRFbGVtZW50KHJvb3QsIG9iamVjdFBhdGgsIGJpbmRNb2RlLCBcIlwiKTtcbiAgICAgICAgICAgIGlmIChiaW5kTW9kZSA9PT0gXCJvblwiKSB7XG4gICAgICAgICAgICAgICAgcmVnaXN0ZXJMaXN0ZW5lcihib3VuZEVsZW1lbnQsIG1vZGVsKTtcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChiaW5kTW9kZSA9PT0gXCJhdHRyXCIpIHtcbiAgICAgICAgICAgICAgICBwYXJlbnRPYmplY3QgPSBvYmplY3RQYXRoLnNwbGl0KFwifFwiKVsxXS5zcGxpdChcIi5cIilbMF07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodHlwZW9mIHBhcmVudE9iamVjdCA9PT0gXCJ1bmRlZmluZWRcIiB8fFxuICAgICAgICAgICAgICAgIHR5cGVvZiBtb2RlbFtwYXJlbnRPYmplY3RdID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcIkludmFsZCBvYmplY3QgcGF0aCBhdCBcIiwgYmluZGVyLCBcIndpdGggbW9kZWw6IFwiLCBtb2RlbCk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgb2JzZXJ2YWJsZVRhcmdldDtcbiAgICAgICAgICAgIG9ic2VydmFibGVUYXJnZXQgPSBtb2RlbFtwYXJlbnRPYmplY3RdLl9vYnNlcnZhYmxlT2JqZWN0O1xuICAgICAgICAgICAgaWYgKCFvYnNlcnZhYmxlVGFyZ2V0KSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBhdHRlbXB0aW5nIHRvIGJpbmQgb24gbm9uLW9ic2VydmFibGUgb2JqZWN0IGF0YCwgYm91bmRFbGVtZW50LkRPTWVsZW1lbnQpO1xuICAgICAgICAgICAgICAgIGlmIChiaW5kTW9kZSA9PT0gXCJ2YWx1ZVwiKSB7XG4gICAgICAgICAgICAgICAgICAgIHJvb3QuaW5uZXJUZXh0ID0gdXRpbHMucmV0dXJuVGFyZ2V0UHJvcGVydHkobW9kZWwsIG9iamVjdFBhdGgsIGZhbHNlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBvYnNlcnZhYmxlVGFyZ2V0LnJlZ2lzdGVyRWxlbWVudChiaW5kTW9kZSwgYm91bmRFbGVtZW50KTtcbiAgICAgICAgICAgIC8vIFNvbWUgYmluZGVycywgc3VjaCBhcyAnZm9yJyBiaW5kZXJzLCBjcmVhdGUgYSBzZXBhcmF0ZSB0cmVlIG1vZGVsIGZvciBhbGwgb2YgdGhlaXIgY2hpbGRyZW5cbiAgICAgICAgICAgIC8vIFRoaXMgYXJyYXkgY29udGFpbnMgYSBsaXN0IG9mIGFsbCAndXByb290aW5nJyBiaW5kZXJzXG4gICAgICAgICAgICBsZXQgdXByb290aW5nQmluZGVycyA9IFtcImZvclwiXTtcbiAgICAgICAgICAgIC8vIFRoaXMgcm9vdCBiZWNvbWVzIGEgbmV3IHRyZWUsIHNvIG5vdyBmdXJ0aGVyIGV4cGxvcmF0aW9uIG9mIHRoaXMgYnJhbmNoIGNhbiBoYXBwZW4gdG8gYXZvaWQgZHVwbGljYXRlIGJpbmRpbmdzXG4gICAgICAgICAgICBpZiAodXByb290aW5nQmluZGVycy5pbmNsdWRlcyhiaW5kTW9kZSkpIHtcbiAgICAgICAgICAgICAgICBpc0luZGVwZW5kZW50RWxlbWVudCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKGlzSW5kZXBlbmRlbnRFbGVtZW50KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgY2hpbGRyZW4gPSByb290LmNoaWxkcmVuO1xuICAgIC8vIGl0ZXJhdGUgdGhyb3VnaCBjaGlsZHJlblxuICAgIGZvciAobGV0IGNoaWxkIG9mIGNoaWxkcmVuKSB7XG4gICAgICAgIGlmIChjaGlsZCBpbnN0YW5jZW9mIEhUTUxFbGVtZW50KSB7XG4gICAgICAgICAgICAvLyBSZWN1cnNpdmVseSBwYXJzZSBhbGwgY2hpbGRyZW4gb2YgY3VycmVudCByb290IGVsZW1lbnRcbiAgICAgICAgICAgIFBhcnNlRE9NZm9yT2JzZXJ2YWJsZXMobW9kZWwsIGNoaWxkKTtcbiAgICAgICAgfVxuICAgIH1cbn1cbi8vIGluc3RhbnRpYXRlcyBhIGJvdW5kIGVsZW1lbnQgc3RvcmluZyB0aGUgRE9NIGVsZW1lbnQgYW5kIHRoZSBvYmplY3QgcGF0aCB0byB3aGljaCBpdCBpcyBsaW5rZWRcbmNsYXNzIEJvdW5kRWxlbWVudCB7XG4gICAgY29uc3RydWN0b3IoRE9NZWxlbWVudCwgb2JqZWN0UGF0aCwgYmluZE1vZGUsIHByb3BlcnR5KSB7XG4gICAgICAgIHRoaXMuRE9NZWxlbWVudCA9IERPTWVsZW1lbnQ7XG4gICAgICAgIHRoaXMub2JqZWN0UGF0aCA9IG9iamVjdFBhdGg7XG4gICAgICAgIHRoaXMuYmluZE1vZGUgPSBiaW5kTW9kZTtcbiAgICAgICAgdGhpcy5wcm9wZXJ0eSA9IHByb3BlcnR5O1xuICAgIH1cbiAgICB1cGRhdGUoKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IHRoaXMudGFyZ2V0W3RoaXMucHJvcGVydHldO1xuICAgICAgICBpZiAodGhpcy51cGRhdGVDYWxsYmFjaykge1xuICAgICAgICAgICAgdmFsdWUgPSB0aGlzLnVwZGF0ZUNhbGxiYWNrKHZhbHVlKTtcbiAgICAgICAgICAgIC8vIFRPRE8gYWRkIGNvbmZpZ3VyYXRpb24gY2FsbGJhY2tzIGZvciBkYXRlIHN0cmluZyBmb3JtYXR0aW5nXG4gICAgICAgIH1cbiAgICAgICAgc3dpdGNoICh0aGlzLmJpbmRNb2RlKSB7XG4gICAgICAgICAgICBjYXNlIFwiYXR0clwiOlxuICAgICAgICAgICAgICAgIGlmICghdGhpcy5hdHRyKSB7XG4gICAgICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIk5vIGF0dHIgdmFsdWUgZGVmaW5lZCBmb3IgYm91bmQgZWxlbWVudFwiKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5ET01lbGVtZW50LnNldEF0dHJpYnV0ZSh0aGlzLmF0dHIsIHZhbHVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5ET01lbGVtZW50LmlubmVyVGV4dCA9IHZhbHVlO1xuICAgIH1cbn1cbi8vICdvbicgYmluZHMgaGF2ZSBhbiBvYmplY3QgcGF0aCBvZiA8ZXZlbnQ+fDxjYWxsYmFjaz5cbmZ1bmN0aW9uIHJlZ2lzdGVyTGlzdGVuZXIoYm91bmRFbGVtZW50LCBtb2RlbCkge1xuICAgIC8vIExvY2F0ZSBzcGxpdCBlbmQgcGFyZW50aGVzZXMgb2ZmXG4gICAgbGV0IGV2ZW50VHlwZSwgbWV0aG9kU2lnbmF0dXJlO1xuICAgIFtldmVudFR5cGUsIG1ldGhvZFNpZ25hdHVyZV0gPSBib3VuZEVsZW1lbnQub2JqZWN0UGF0aC5zcGxpdChcInxcIik7XG4gICAgY29uc3QgbWV0aG9kTmFtZSA9IG1ldGhvZFNpZ25hdHVyZS5zcGxpdChcIihcIilbMF07XG4gICAgY29uc3QgcGFyYW1ldGVycyA9IG1ldGhvZFNpZ25hdHVyZS5zcGxpdChcIihcIilbMV0uc3BsaXQoXCIpXCIpWzBdO1xuICAgIGNvbnN0IGFyZ0FycmF5ID0gW107XG4gICAgZm9yIChsZXQga2V5IG9mIHBhcmFtZXRlcnMuc3BsaXQoXCIsXCIpKSB7XG4gICAgICAgIGFyZ0FycmF5LnB1c2gobW9kZWxba2V5XSk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIGxldCBjYWxsYmFja1BhcmVudCA9IHV0aWxzLnJldHVyblRhcmdldFByb3BlcnR5KG1vZGVsLCBtZXRob2ROYW1lLCB0cnVlKTtcbiAgICAgICAgbGV0IGNhbGxiYWNrID0gdXRpbHMucmV0dXJuVGFyZ2V0UHJvcGVydHkobW9kZWwsIG1ldGhvZE5hbWUpO1xuICAgICAgICBpZiAoIWNhbGxiYWNrKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYWxsYmFjayBub3QgZm91bmQgYXQgXCIgKyBtZXRob2RTaWduYXR1cmUgKyBcImluIG1vZGVsOiBcIiArIG1vZGVsKTtcbiAgICAgICAgfVxuICAgICAgICBib3VuZEVsZW1lbnQuRE9NZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKGV2ZW50VHlwZSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgY2FsbGJhY2suYXBwbHkoY2FsbGJhY2tQYXJlbnQsIGFyZ0FycmF5KTtcbiAgICAgICAgfSk7XG4gICAgfVxuICAgIGNhdGNoIChlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihgJHtlcnIubmFtZX06ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgfVxufVxubGV0IHV0aWxzID0ge1xuICAgIGRlZXBDbG9uZTogZnVuY3Rpb24gZGVlcENsb25lKG9iamVjdCkge1xuICAgICAgICB2YXIgbmV3T2JqZWN0ID0ge307XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KG9iamVjdCkpIHtcbiAgICAgICAgICAgIGxldCBuZXdBcnJheSA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgaXRlbSBvZiBvYmplY3QpIHtcbiAgICAgICAgICAgICAgICBsZXQgY2xvbmVJdGVtID0gZGVlcENsb25lKGl0ZW0pO1xuICAgICAgICAgICAgICAgIG5ld0FycmF5LnB1c2goY2xvbmVJdGVtKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0ICE9IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gb2JqZWN0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IHByb3BlcnR5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgbmV3T2JqZWN0W3Byb3BlcnR5XSA9IGRlZXBDbG9uZShvYmplY3RbcHJvcGVydHldKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3T2JqZWN0O1xuICAgIH0sXG4gICAgZGVlcFByb3h5OiBmdW5jdGlvbiBkZWVwUHJveHkob2JqZWN0LCBoYW5kbGVyKSB7XG4gICAgICAgIC8vIGRvIG5vdCByZW1ha2Ugb2JzZXJ2YWJsZSBvYmplY3RzXG4gICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0ID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJveHkob2JqZWN0LCBoYW5kbGVyKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShvYmplY3QpKSB7XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IG9iamVjdC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgICAgICAgIG9iamVjdFtpXSA9IGRlZXBQcm94eShvYmplY3RbaV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgb2JqZWN0ID0gbmV3IFByb3h5KG9iamVjdCwgaGFuZGxlcik7XG4gICAgICAgICAgICByZXR1cm4gb2JqZWN0O1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGl0ZW0gaW4gb2JqZWN0KSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIG9iamVjdFtpdGVtXSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICAgICAgICAgIG9iamVjdFtpdGVtXSA9IGRlZXBQcm94eShvYmplY3RbaXRlbV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlb2Ygb2JqZWN0ID09PSBcIm9iamVjdFwiICYmIG9iamVjdCkge1xuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm94eShvYmplY3QsIGhhbmRsZXIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvYmplY3Q7XG4gICAgfSxcbiAgICAvLyBtZXRob2QgdG8gcmVtb3ZlIGZpcnN0IGFuZCBsYXN0IG9iamVjdCBmb3Igb1JlZiBhdHRyaWJ1dFxuICAgIHByZXBhcmVPYmplY3RQYXRoOiBmdW5jdGlvbiAob2JqZWN0UGF0aCkge1xuICAgICAgICBsZXQgb2JqQXJyYXkgPSBvYmplY3RQYXRoLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgbGV0IHByb3BlcnR5ID0gb2JqQXJyYXlbb2JqQXJyYXkubGVuZ3RoIC0gMV07XG4gICAgICAgIG9iakFycmF5ID0gb2JqQXJyYXkuc3BsaWNlKDEpO1xuICAgICAgICBvYmpBcnJheSA9IG9iakFycmF5LmpvaW4oXCIuXCIpO1xuICAgICAgICByZXR1cm4gb2JqQXJyYXk7XG4gICAgfSxcbiAgICAvLyBnZW5lcmFsaXppbmcgdGhlIG1ldGhvZCB0byBhY2Nlc3Mgb2JqZWN0IHByb3BlcnR5IHVzaW5nIHN0cmluZyBwYXRoIHN1Y2ggYXMgXCJwZXJzb24udGFzay5kdWVEYXRlXCJcbiAgICByZXR1cm5UYXJnZXRQcm9wZXJ0eTogZnVuY3Rpb24gcmV0dXJuVGFyZ2V0UHJvcGVydHkob2JqZWN0VGFyZ2V0LCBwYXRoVG9PYmplY3QsIGdldFBhcmVudCkge1xuICAgICAgICBsZXQgdGFyZ2V0Q2hpbGQgPSBvYmplY3RUYXJnZXQ7XG4gICAgICAgIGxldCBzcGxpdFBhdGggPSBwYXRoVG9PYmplY3Quc3BsaXQoXCIuXCIpO1xuICAgICAgICBsZXQgaSA9IDA7XG4gICAgICAgIGlmIChzcGxpdFBhdGhbMF0gPT09IFwicm9vdFwiKSB7XG4gICAgICAgICAgICB0YXJnZXRDaGlsZCA9IHprLnJvb3RfbW9kZWw7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKGkgPCBzcGxpdFBhdGgubGVuZ3RoKSB7XG4gICAgICAgICAgICBpZiAoZ2V0UGFyZW50ICYmIGkgPT09IHNwbGl0UGF0aC5sZW5ndGggLSAxKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRhcmdldENoaWxkO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGFyZ2V0Q2hpbGQgPSB0YXJnZXRDaGlsZFtzcGxpdFBhdGhbaV1dO1xuICAgICAgICAgICAgaWYgKCF0YXJnZXRDaGlsZCkge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihwYXRoVG9PYmplY3QgKyBcIiBpcyBhbiBpbnZhbGlkIHByb3BlcnR5IHBhdGhcIik7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpKys7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRhcmdldENoaWxkO1xuICAgIH0sXG59O1xuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8vIGRlZmluZSBnZXR0ZXIgZnVuY3Rpb25zIGZvciBoYXJtb255IGV4cG9ydHNcbl9fd2VicGFja19yZXF1aXJlX18uZCA9IChleHBvcnRzLCBkZWZpbml0aW9uKSA9PiB7XG5cdGZvcih2YXIga2V5IGluIGRlZmluaXRpb24pIHtcblx0XHRpZihfX3dlYnBhY2tfcmVxdWlyZV9fLm8oZGVmaW5pdGlvbiwga2V5KSAmJiAhX193ZWJwYWNrX3JlcXVpcmVfXy5vKGV4cG9ydHMsIGtleSkpIHtcblx0XHRcdE9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCBrZXksIHsgZW51bWVyYWJsZTogdHJ1ZSwgZ2V0OiBkZWZpbml0aW9uW2tleV0gfSk7XG5cdFx0fVxuXHR9XG59OyIsIl9fd2VicGFja19yZXF1aXJlX18ubyA9IChvYmosIHByb3ApID0+IChPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKSkiLCIvLyBkZWZpbmUgX19lc01vZHVsZSBvbiBleHBvcnRzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnIgPSAoZXhwb3J0cykgPT4ge1xuXHRpZih0eXBlb2YgU3ltYm9sICE9PSAndW5kZWZpbmVkJyAmJiBTeW1ib2wudG9TdHJpbmdUYWcpIHtcblx0XHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgU3ltYm9sLnRvU3RyaW5nVGFnLCB7IHZhbHVlOiAnTW9kdWxlJyB9KTtcblx0fVxuXHRPYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7IHZhbHVlOiB0cnVlIH0pO1xufTsiLCJpbXBvcnQge3prfSBmcm9tIFwiLi4vc3JjL3prXCJcblxubGV0IHBlcnNvbiA9IHtcbiAgbmFtZTogXCJoYXJyeVwiLFxuICBsYXN0TmFtZTogXCJiYW5hbmFcIixcbiAgbGlzdEl0ZW1zOiBbXG4gICAgeyBwcm9wOiBcIjFcIiwgcHJvcDI6IFwiZXJpY1wiLCBwcm9wMzogXCJ0aHJlZVwiIH0sXG4gICAgeyBwcm9wOiBcIjJcIiwgcHJvcDI6IFwiZXJpY1wiLCBwcm9wMzogXCJ0aHJlZVwiIH0sXG4gICAgeyBwcm9wOiBcIjNcIiwgcHJvcDI6IFwiZXJpY1wiLCBwcm9wMzogXCJ0aHJlZVwiIH0sXG4gICAgeyBwcm9wOiBcIjRcIiwgcHJvcDI6IFwiZXJpY1wiLCBwcm9wMzogXCJ0aHJlZVwiIH0sXG4gICAgeyBwcm9wOiBcIjVcIiwgcHJvcDI6IFwiZXJpY1wiLCBwcm9wMzogXCJ0aHJlZVwiIH0sXG4gIF0sXG59O1xuXG5mdW5jdGlvbiBtb2RlbCgpIHtcbiAgdGhpcy5wZXJzb24gPSAgemsubWFrZU9ic2VydmFibGUocGVyc29uKTtcblxuICBsZXQgZW1wbG95ZWUgPSB7XG4gICAgaGFpcmRvOiBcIm9yYW5nZVwiLFxuICAgIG1hbmFnZXI6IHtcbiAgICAgIHJlcG9ydDoge1xuICAgICAgICBmaXJzdE5hbWU6IFwiam9obmF0aGFuXCIsXG4gICAgICB9LFxuICAgIH0sXG4gICAgdGVzdEY6IGZ1bmN0aW9uICgpIHsgXG4gICAgICBjb25zb2xlLmxvZyhcInRlc3Rmd29ya2VkXCIpO1xuICAgIH0sXG4gIH07XG4gIHRoaXMuZW1wbG95ZWUgPSAgemsubWFrZU9ic2VydmFibGUoZW1wbG95ZWUpO1xuXG4gIHRoaXMuYWRkVGFza0Zvcm1WYWx1ZSA9ICB6ay5tYWtlT2JzZXJ2YWJsZSh7XG4gICAgcHJvcDogXCJwcm9wXCIsXG4gICAgcHJvcDI6IFwicHJvcDJcIixcbiAgICBwcm9wMzogXCJ0aHJlZVwiLFxuICB9KTtcblxuICB0aGlzLnNhdmVUYXNrID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIHRoaXMucGVyc29uLnB1c2hUb0ZvcmVhY2goJ3BlcnNvbi5saXN0SXRlbXMnLHRoaXMuYWRkVGFza0Zvcm1WYWx1ZS5nZXRkYXRhT2JqZWN0UHJveHkoKSlcbiAgICB0aGlzLnBlcnNvbi5saXN0SXRlbXMucHVzaCh0aGlzLmFkZFRhc2tGb3JtVmFsdWUpO1xuICB9O1xuICB0aGlzLnJlbW92ZUl0ZW0gPSBmdW5jdGlvbiAoaXRlbSkge1xuICAgIGxldCBpbmRleCA9IHBlcnNvbi5saXN0SXRlbXMuaW5kZXhPZihpdGVtKTtcbiAgICBwZXJzb24ubGlzdEl0ZW1zLnNwbGljZShpbmRleCwgMSk7XG4gIH07XG4gIHRoaXMucGFyYW0gPSBcImZvb1wiO1xuICB0aGlzLmphbSA9IFwiYmFyXCI7XG5cbiAgdGhpcy50ZXN0RnVuY3Rpb24gPSBmdW5jdGlvbiAoeCwgeSkge1xuICAgIGNvbnNvbGUubG9nKHgsIHkpO1xuICB9O1xufVxuXG5jb25zdCBtYWluTW9kZWwgPSBuZXcgbW9kZWwoKTtcblxuemsuaW5pdGlhdGVNb2RlbChtYWluTW9kZWwsIGRvY3VtZW50LmNoaWxkcmVuWzBdKTtcbiJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==