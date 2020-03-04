module.exports.DEBUG = {
    // key values used in processing
    values: true ,

    // when a prommise starts
    prommisesStarting:true,

    // when a prommise resolves
    prommiseResolved: true,
    
    // when a new request is received
    connectionStart:true,

    // when the request is handled
    connectionFinish:true,
    
    // data the server sends to the client
    dataOut: true, 

    // data the server receives from the client
    dataIn: true,
    }