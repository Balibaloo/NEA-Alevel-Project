//router funciton
/////////////////////// ADD FUNCTION REQUIREMENTS
const Auth = require('../helpers/auther')
const imageHandler = require('../helpers/imageHandler')
const GSON = require('gson')

//////////////////////////////////////////////////////////////////////////////  HELPER FUNCTIONS

var checkUniqueEmail = (db, Email) => {
    //// checks if an email adress is already saved in the databse
    db.query(`SELECT *
            FROM user_profile
            WHERE Email = '${Email}'`, (error, results) => {
        if (error) {
            console.log(error)
        } else if (results) {
            return false
        } else {
            return true
        }
    })
};

var checkUniqueUsername = (db, username) => {
    //// checks if a username is already saved in the database
    db.query(`SELECT *
            FROM user_profile
            WHERE username = '${username}'`, (error, results) => {
        if (error) {
            console.log(error)
        } else if (results) {
            return false
        } else {
            return true
        }
    })

};


var arrayToSQL = (arr) => {
    //// converts an array to an SQL insertable format String
    let finalString = '('
    arr.forEach((item, index) => {
        if (index !== 0) {
            finalString += ' ,'
        }
        if (item instanceof Array) {
            finalString += `"[${item.toString()}]"`
        } else {
            finalString += `"${item}"`
        }

    })
    finalString += ')'
    return finalString

}

var getListing = (req) => new Promise((resolve, reject) => {
    //// pulls a Listing entry from databse given listingID
    req.db.query(`SELECT *
                FROM listing
                WHERE listingID = '${req.body.listingID}'`, (error, results) => {
        results = results[0]
        if (error) {
            req.error = error
            req.error.details = 'select listing'
            reject(req)
        } else if (results) {
            req.listing = results
            resolve(req)
        } else {
            req.error = new Error('no listing found')
            req.error.details = 'no listing found'
            reject(req)
        }

    })
});

var getListingItems = (req) => new Promise((resolve, reject) => {
    //// pulls every item associated with a listingID from database
    req.db.query(`SELECT *
                FROM listing_item
                WHERE listingID = '${req.body.listingID}'`, (error, results) => {
        if (error) {
            req.error = error
            req.error.details = 'lsiting fetch error'
            reject(req)
        } else if (results[0]) {
            results.forEach((element, index) => {
                //// converts arrays stored in text form to array objects
                results[index].tags = element.tags.replace('[', '').replace(']', '').split(',')
                results[index].images = element.images.replace('[', '').replace(']', '').split(',')
            });

            req.listing.itemList = results

            console.log('listing items fetched successfully')
            resolve(req)
        } else {
            req.error = new Error('no listing items found')
            reject(req)
        }
    })

});

var saveViewRequest = (req) => new Promise((resolve, reject) => {
    //// logs a view request if the authorID does not match userID
    if (req.userData.userID != req.listing.authorID) {
        Auth.genID((newID) => {
            req.db.query(`INSERT INTO view_log
                    (viewID, userID ,listingID)
                    VALUES ('${newID}', '${req.userData.userID}', '${req.listing.listingID}')`, (error) => {
                if (error) {
                    req.error = error
                    req.error.details = 'lsiting view save error'
                    reject(req)
                } else {
                    resolve(req)
                }
            })
        })
    }
});

var changeWantedTags = (req) => new Promise((resolve, reject) => {
    //// changes a users wantedTags array and global wanted tags table on tag changes
    // needs [body.newTags]

    let db = req.db

    let modifyTagsPromise = ([db, array, type]) => new Promise((resolve, reject) => {
        let num = (type == "+ 1") ? 1 : 0

        array.forEach((element) => {
            db.query(`
                IF EXISTS(SELECT tag FROM wanted_tags WHERE tag = '${element}')
                        UPDATE wanted_tags SET numOfPeople = numOfPeople ${type} WHERE tag = '${element}'
                ELSE
                    BEGIN
                        INSERT INTO wanted_tags (tag, numOfPeople) values ('${element}', ${num})
                    END
                `, (error) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(req)
                }

            })
        })
    });

    db.query(`SELECT wantedTags
            FROM user_profile
            WHERE userID = '${req.userData.userID}'`,
        (error, results) => {
            if (error) {
                req.error = error
                reject(req)
            } else {
                let currentTags = results[0].wantedTags.slice(1, -1).split(',')
                let newTags = req.body.newTags

                let tagsToAdd = newTags.filter(function (el) {
                    return currentTags.indexOf(el) == -1;
                });

                let tagsToRemove = currentTags.filter(function (el) {
                    return newTags.indexOf(el) == -1;
                });

                modifyTagsPromise([db, tagsToRemove, "- 1"])
                    .then(modifyTagsPromise([db, tagsToAdd, "+ 1"]))
                    .then(resolve(req))
                    .catch((error) => {
                        req.error = error
                        reject(req)
                    })
            }
        })
});


module.exports.router = function (app, db) {

    //////////////////////////////////////////////////////////////////////////  TEST ZONE

    app.get('/getImages', (req, res) => {
        if (!req.query.images) {
            res.send("No images given to load")
        } else {
            imageHandler.getImages(req.query.images).then((loadedImages) => {
                    res.send(loadedImages);
                    console.log(loadedImages)
                })
                .catch(console.log)
        }
    });

    app.get('/', (req, res) => {
        console.log('request received')
        res.json({
            "message": "Conection Successful!"
        });
    });

    app.get('//', Auth.checkToken, (req, res) => {
        res.json({
            "message": "Authenticated Conection Successful!"
        });
    });

    //////////////////////////////////////////////////////////////////////////  USER ACCOUTNS

    app.get('/checkUniqueUsername', (req, res) => {
        //// requires body.username
        if (checkUniqueUsername(req.body.username)) {
            res.json({
                "isUnused": True,
                "message": 'username available'
            });
        } else {
            res.json({
                "isUnused": False,
                "message": 'username not available'
            });
        }
    });

    app.get('/checkUniqueEmail', (req, res) => {
        //// requires body.email
        if (checkUniqueEmail(req.body.email)) {
            res.json({
                "isUnused": True,
                "message": 'username available'
            });
        } else {
            res.json({
                "isUnused": False,
                "message": 'username not available'
            });
        }
    });

    app.post('/createAccount', (req, res) => {
        // requires body.{
        // username, password String
        // firstName , lastName
        // email
        // phone
        //}

        var saveUserPromise = (req) => new Promise((resolve, reject) => {
            req.userData = req.body

            Auth.genID((userID) => {
                req.userData.userID = userID
                db.query(`INSERT INTO user_profile
                        (userID, fName, lName, email, phone)
                        VALUES ('${req.userData.userID}','${firstName}','${lastName}','${email}',${phone},[])`,
                    (error, result) => {
                        if (error) {
                            req.error = error
                            req.error.details = 'User save'
                            reject(req)
                        } else {
                            resolve(req)
                        }
                    })
            });
        });

        saveUserPromise(req)
            .then(Auth.clientEncode) ////////////////////////////
            .then(Auth.saveUser)
            .then(Auth.logToken)
            .then((req) => {
                res.json({
                    'message': 'User Created',
                    'userToken': req.userData.userToken
                })
            })
            .catch((req) => {
                console.log('User create error (', req.error.details, ')', req.error.message);
                res.json({
                    'message': 'Could not create user',
                    'error': req.error
                })
                db.query(`DELETE FROM user_profile
                        WHERE userID = '${req.userData.userID}'`,
                    (error) => {
                        console.log('User Clean up Success')
                    })
            })
    });

    app.get('/auth/login', (req, res) => {

        if (req.headers.authorization) {

            var logInPromise = (req) => new Promise((resolve, reject) => {
                req.userData = {}
                var authCreds = req.headers.authorization.split(' ');
                var decodedCreds = Buffer.from(authCreds[1], 'base64').toString().split(':');

                req.userData.username = decodedCreds[0]
                req.userData.password = decodedCreds[1]

                resolve(req)
            })

            logInPromise(req)
                .then(Auth.clientEncode) /////////////////////////////////////
                .then(Auth.checkUP)
                .then(Auth.logToken)
                .then((req) => {
                    res.json({
                        'message': 'Logged in succesfully',
                        'userToken': req.userData.userToken
                    })
                })
                .catch((error) => {
                    console.log('Log in error (', error.details, ')', error);
                    res.status(500).json({
                        'message': 'Log In failiure',
                        'error': error
                    })
                })


        } else {
            res.status(403).json({
                'message': "no credentials provided",
            })
        }

    });

    app.get('/auth/getUserProfile', Auth.checkToken, (req, res) => {
        db.query(`SELECT *
                FROM user_profile
                WHERE userID = '${req.userData.userID}' `, function (error, result) {
            if (error) {
                throw error
            } else if (result[0]) {
                delete result[0].userID
                res.status(200).json({
                    "message": "Profile Fetches Succesfully",
                    "userProfile": result[0]
                })
            } else {
                res.status(404).json({
                    "message": 'no user found'
                })
            };

        });
    });

    app.get('/changeWantedTags', Auth.checkToken, (req, res) => {
        req.db = db;
        changeWantedTags(req)
            .then((req) => {
                res.json({
                    "message": 'Wanted Tags Changed Successfully'
                })
            })
            .catch((req) => {
                console.log('Tag Change Error (', req.error.details, ')', req.error.message);
                res.status(500).json({
                    "message": 'Server Error',
                    "error": req.error
                })
            })
    });

    //////////////////////////////////////////////////////////////////////////  LISTINGS

    app.post('/createListing', Auth.checkToken, (req, res) => {
        req.db = db;
        Auth.genID((idOne) => {
            var {
                title,
                body,
                end_date,
                location,
                itemList,
                mainPhoto
            } = req.body

            var listingID = idOne
            var authorID = req.userData.userID

            db.query(`INSERT INTO listing
(listingID, authorID, title, body, mainPhoto , end_date, location)
VALUES ('${listingID}','${authorID}','${title}','${body}','${mainPhoto}','${end_date}','${location}')`,
                (error) => {
                    if (error) {
                        console.log(error)
                        res.status(500).json({
                            "message": 'Server Error',
                            "error": error
                        })
                    } else {
                        let itemListString = ''
                        itemList.forEach((item, index) => {
                            if (index !== 0) {
                                itemListString += ','
                            }
                            Auth.genID((newID) => {
                                itemListString += arrayToSQL([newID, listingID, item.name, item.description, item.tags, item.images])
                            })
                        })

                        db.query(`INSERT INTO listing_item (itemID, listingID, name, description, tags, images) VALUES ${itemListString}`, (error) => {
                            if (error) {
                                console.log('Listing Item Save Error')
                                res.status(500).json({
                                    "message": 'Server Error',
                                    "error": error
                                })
                            } else {
                                console.log('Listing Saved Successfully')
                                res.json({
                                    "message": 'Listing Saved Successfully',
                                    "Data": listingID
                                })
                            }

                        })
                    }
                }
            )
        })




    });

    app.get('/getListingNoAuth', (req, res) => {
        req.db = db
        getListing(req)
            .then(getListingItems)
            .then((req) => {
                console.log('Listing Fetched Successfully')
                res.json({
                    "message": 'Listing Fetched Succesfully',
                    "Data": req.listing
                })
            })
            .catch((req) => {
                res.status(500).json({
                    "message": 'Server Error',
                    "error": req.error
                })
                console.log('Listing Fetch Error (', req.error.details, ')', req.error.message);
            })
    });

    app.get('/getListingAuthenticated', Auth.checkToken, (req, res) => {
        req.db = db
        getListing(req)
            .then(getListingItems)
            .then(saveViewRequest)
            .then((req) => {
                console.log('Listing Fetched Successfully')
                res.json({
                    "message": 'Listing Fetched Succesfully',
                    "Data": req.listing
                })
            })
            .catch((req) => {
                res.status(500).json({
                    "message": 'Server Error',
                    "error": req.error
                })
                console.log('Listing Fetch Error (', req.error.details, ')', req.error.message);
            })
    });

    //////////////// construciton zone
    app.get('/getFrontPageListings', (req, res) => {
        ////////////////// save a view as a date, prune views older than 24 hrs
        ////////////////// return most viewed in 24 hrs

    });

    app.get('/getFilteredListings', (req, res) => {
        //////////////////////////////// WIP
        db.query(`SELECT *
            FROM listing
            WHERE 
            LIKE
            IN `,
            (error, results) => {
                console.log(`(${req.body.filterTags})`)
                if (error) {
                    console.log('Filter listing error ', error)
                    res.status(500).json({
                        "message": 'Server Error',
                        "error": req.error
                    })
                } else {
                    console.log('Filtered Results Sent Succesfully')
                    res.json({
                        "message": 'Filtered Results Fetched Succesfully',
                        "Data": results
                    })
                }
            })
    });
    /////////////////
    app.get('/getRecentListings', Auth.checkToken, (req, res) => {
        db.query(`SELECT *
    FROM listing
    RIGHT JOIN
    (SELECT *
        FROM view_log
        ORDER BY view_date DESC
        LIMIT 10
        ) AS top10
    ON listing.listingID = top10.listingID
    WHERE userID = '${req.userData.userID}'
    `, (error, results) => {
            if (error) {
                console.log('Recent Listing Error ', error)
                res.status(500).json({
                    "message": 'Server Error',
                    "error": error
                })
            } else {
                console.log('Recent Listings Sent Successfully')
                res.json({
                    "message": 'Recent Listings Fetched Succesfully',
                    "Data": results
                })
            }
        })
    });

    app.get('/getDesiredItems', (req, res) => {
        db.query(`SELECT * FROM wanted_tags`, (error, results) => {
            if (error) {
                console.log('Get Desired Items Error: ', error)
                res.status(500).json({
                    "message": 'Server Error',
                    "error": error
                })
            } else {
                res.json({
                    "message": 'Desired Items Fetched Succesfully',
                    "Datat": results
                })
            }
        });
    })

    //////////////////////////////////////////////////////////////////////////  MESAGES

    app.post('/sendMessage', Auth.checkToken, (req, res) => {
        Auth.genID((messageID) => {
            db.query(`INSERT INTO message_history
(messageID,senderID,targetID,title,body,time_sent)
VALUES (${messageID},${req.userData.userID},${req.body.targetID},${req.body.title},${req.body.body},${new Date})`, (error, results) => {
                if (error) {
                    console.log('Message Sending Error :', error)
                    res.status(500).json({
                        "message": 'Server Error',
                        "error": error
                    })
                } else {
                    console.log('User Message Sent Successfully')
                    res.json({
                        "message": 'Message Sent'
                    })
                }
            })
        })

    });

    app.get('/getUserMessages', Auth.checkToken, (req, res) => {
        db.query(`SELECT *
    FROM message_history
    WHERE targetID = '${req.userData.userID}'`, (error, results) => {
            if (error) {
                console.log('Message Fetch Error', error);
                res.status(500).json({
                    "message": 'Server Error',
                    "error": req.error
                })
            } else if (results[0]) {
                console.log('User Messages Fetched Successfully')
                res.json({
                    "message": 'Messages Fetched Succesfully',
                    "Data": results
                })
            } else {
                res.status(500).json({
                    "message": 'No Messages Found'
                })
            }
        })
    });





};