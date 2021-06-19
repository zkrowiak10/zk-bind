


// Recursive function that locates and registers any html element descending from root that should be observed 
function ParseDOMforObservables(model, root = document) 
{
    // if (!root.hasChildNodes) {return}
    children = root.children
    
    // iterate through children 
    walkIterator:
    for (child of children) {

        // if HTML element contains binder
        if (child.getAttribute('zk-bind')){
            // parse the bind command
            // bind syntax is '<bindMode>: <object path'
            let binder = child.getAttribute('zk-bind')
            let splitBinder = binder.split(":")

            // isolate bindMode string and object path (getting rid of preceding white space)
            let bindMode = splitBinder[0] 
            let objectPath = splitBinder[1].trim()

            // Current array of valid bind modes for validity checking
            validBindModes = ['text', 'value', 'for']


            // Verify that bind mode is valid
            if (!validBindModes.includes(bindMode)) 
            {
                throw new Error(bindMode + " is not a valid bind mode")
            } 

 
            // Parent object in path is expected to be an attribute of the model parameter of this function
            // Parse parent object, and add this element to the appropriate list
            let parentObject = objectPath.split('.')[0]

            // A little messy, but 'for' binders receive an argument of 'indexKey of iterable' where
            // iterable is the typical objectpaty. 
            if (bindMode === 'for') {
                parentObject = objectPath
                                .split('of')[1]
                                .trim()
                                .split('.')[0]

                
            }
            // Check that bind reference exists in model
            if ((typeof model[parentObject] === undefined)) {
                throw new Error (parentObject + "Is not a registered observable")
            }
            

            // Push the element to the appropriate list 
            boundElement = new BoundElement(child, objectPath)
            model[parentObject].registerElement(bindMode, boundElement)

            // Some binders, such as 'for' binders, create a separate tree model for all of their children
            // This array contains a list of all 'uprooting' binders
            let uprootingBinders = ['for']

            // This child becomes a new tree, so now further exploration of this branch can happen to avoid duplicate bindings
            if (uprootingBinders.includes(bindMode)) {
                
                continue walkIterator
            }


            }

        // Recursively parse all children of current root element
        ParseDOMforObservables(model, child) 

 
        
    }
}

// instantiates a bound element storing the DOM element and the object path to which it is linked
function BoundElement(DOMelement, objectPath) {
    this.DOMelement = DOMelement
    this.objectPath = objectPath
}
// takes a standard JSON object as a parameter, instantiate an observable object
function ObservableObject(obj) {
    
    let self = this;

    // copy all object properties from simple JSON to this object
    let dataObject = obj

    // Create empty array for both text and value elements
    let receivers = []
    let transmitters = []
    let forEachComponents = []
    
    // Function to update all elements on state change
    function updateOnStateChange(objectPath,updateAll=false) {
        for (element of receivers) {
            if ((objectPath === element.objectPath) || updateAll) {
                let targetProperty = returnTargetProperty(element.objectPath)
                element.DOMelement.innerHTML = targetProperty
            }
        }
    }

    // Parse property path of binding and return object at that location
    function returnTargetProperty(pathToObject) {
        let targetChild = dataObject
        let splitPath = pathToObject.split('.')
        for (let i = 1; i < splitPath.length; i++) {
            targetChild = targetChild[splitPath[i]]
            if (!targetChild) {
                throw new Error(pathToObject + " is an invalid property path")
            }
        
        

        }
        return targetChild
    }


    // take a bound 'transmitter' element and add an event lister to update model object and transmit to receivers
    function initializeTransmitter(boundElement) {
            boundElement.DOMelement.addEventListener("keyup", (KeyboardEvent) => {
            pathString = boundElement.objectPath
            revisedPath = pathString.replace(pathString.split(['.'])[0],'dataObject')
            eval(revisedPath + "= boundElement.DOMelement.value");
            updateOnStateChange(boundElement.objectPath)
        })
    }

    function updateArrayOnStateChange(boundElement){

    }



    // A 'for' binder repeats the syntax in the children elements for each item in the defined iterable
    // This function must be able to control the items in the list (push/pop) and change their value if the
    // model data changes.
    function initializeForeach(boundElement) {

        // parse syntax, note that 'objectPath' refers to the foreach syntax of the for element
        tempList  = boundElement.objectPath.split('of')
        let iteratorKey = tempList[0].trim()
        let iterableObjectPath = tempList[1].trim()
        let iterable = returnTargetProperty(iterableObjectPath)

        // The application should enforce that the boundElement only has one child (the iterator template)
        // Then, it should clone that item and append it iterable.length - 1 times 
        // The parent object (curent boundElement) needs to be added to the bound elements array
        // problem noted: when the ObservableObject instantiates, it copies the object parameter, meaning that scoped sub models
        // Do not reflect changes to the object model they are descendent from

        for (item of iterable) {
            let clone = boundElement.DOMelement.children[0].cloneNode(true)
            boundElement.DOMelement.appendChild(clone)
            
            console.log(item)
            let subModel = {}
            subModel[iteratorKey] = new ObservableObject(item)
            ParseDOMforObservables(subModel, clone)
        }

        
        
        
    }

    // function to register an element, perform any intialization,a nd add to appropriate array
    this.registerElement = function (bindMode, boundElement) {

        switch (bindMode) {
            case "text" :
                transmitters.push(boundElement);
                initializeTransmitter(boundElement);
                break
            case "value": 
                receivers.push(boundElement);
                updateOnStateChange(boundElement.objectPath);
                break
            case "for":
                initializeForeach(boundElement);

        }
    }
    
    // Method for pushing elements to each of those arrays that adds the appropriate event listeners to them
    // for example, an input element should have an onkeyup listener 
    // callback method for each event type (eg. text binds should iterate through array of value elements and update)
    


}

// *********************************************  client code ************************************************
let person = {
    name : "harry",
    lastName: "banana",
    listItems: [
        {prop: "test"},
        {prop: "2"},
        {prop: "3"},
        {prop: "4"},
        {prop: "5"},
    ]
}
function model() {
    this.person = new ObservableObject(person)

    let employee = {
        hairdo: "orange",
        manager: {
            report : {
                firstName: "johnathan"
            }
        }
    }
    this.employee = new ObservableObject(employee)
}

mainModel = new model()
ParseDOMforObservables(mainModel)

