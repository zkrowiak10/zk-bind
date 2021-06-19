let person = {
    name : "harry",
    lastName: "banana"
}

objectRegistry = []

// Recursive function that locates and registers any html element descending from root that should be observed 
function ParseDOMforObservables(model, root = document) 
{
    if (!root.hasChildNodes) {break}
    children = root.children
    
    // iterate through children 
    walkIterator:
    for (child of children) {

        // if HTML element contains binder
        if (child.getAttribute('zk-bind')){
            // parse the bind command
            // bind syntax is '<bindMode>: <object path'
            let binder = element.getAttribute('zk-bind')
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

            // Some binders, such as 'for' binders, create a separate tree model for all of their children
            // This array contains a list of all 'uprooting' binders
            let uprootingBinders = ['for']

            // This child becomes a new tree, so now further exploration of this branch can happen to avoid duplicate bindings
            if (uprootingBinders.includes(bindMode)) {
                continue walkIterator
            }

            // Parent object in path is expected to be an attribute of the model parameter of this function
            // Parse parent object, and add this element to the appropriate list
            parentObject = objectPath.split('.')[0]

            // Check that bind reference exists in model
            if ((typeof model[parentObject] === undefined)) {
                throw new Error (parentObject + "Is not a registered observable")
            }

            // Push the element to the appropriate list 
            boundElement = new BoundElement(element, objectPath)
            model[parentObject].registerElement(bindMode, boundElement)

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
    for (property in obj) {
        self[property] = obj[property]
    }

    // Create empty array for both text and value elements
    receivers = []
    transmitters = []

    // Function to update all elements on state change
    function updateOnStateChange(objectPath,updateAll=false) {
        for (element of receivers) {
            if ((objectPath === element.objectPath) || updateAll) {
                let targetProperty = returnTargetProperty(element.objectPath)
                console.log(targetProperty)
                element.DOMelement.innerHTML = targetProperty
            }
        }
    }

    // Parse property path of binding and return object at that location
    function returnTargetProperty(pathToObject) {
        let targetChild = self
        let splitPath = pathToObject.split('.')
        for (let i = 1; i < splitPath.length; i++) {
            targetChild = targetChild[splitPath[i]]
            console.log(targetChild)
            if (!targetChild) {
                console.log(self)
                throw new Error(pathToObject + " is an invalid property path")
            }
        
        

        }
        return targetChild
    }


    // take a bound 'transmitter' element and add an event lister to update model object and transmit to receivers
    function initializeTransmitter(boundElement) {
            boundElement.DOMelement.addEventListener("keyup", (KeyboardEvent) => {
            pathString = boundElement.objectPath
            revisedPath = pathString.replace(pathString.split(['.'])[0],'self')
            eval(revisedPath + "= boundElement.DOMelement.value");
            updateOnStateChange(boundElement.objectPath)
        })
    }

    // function to register an element, perform any intialization,a nd add to appropriate array
    this.registerElement = function (bindMode, boundElement) {

        switch (bindMode) {
            case "text" :
                transmitters.push(boundElement);
                initializeTransmitter(boundElement);
            case "value": 
                receivers.push(boundElement)
                updateOnStateChange(boundElement.objectPath)

        }
    }
    
    // Method for pushing elements to each of those arrays that adds the appropriate event listeners to them
    // for example, an input element should have an onkeyup listener 
    // callback method for each event type (eg. text binds should iterate through array of value elements and update)
    


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

