
testListing = {"someProperty" : 1,
                "somelists" : [{"someObj": 1},{"someObj":0}],
                "afdawj": "123e312"}


let intToBool = (obj) => {
    for (var property in obj){
        if (Array.isArray(obj[property])){
            obj[property] = obj[property].map((item) => {
                return intToBool(item)
            })

        } else if (typeof obj[property] == typeof 1){
            if (obj[property] == 1) {obj[property] = true}
            if (obj[property] == 0) {obj[property] = false}

        } else if (typeof obj[property] == typeof {}){
            obj[property] = intToBool(obj[property])
        }}
        
        return obj
    }


console.log(intToBool(testListing))