const Auth = require('../Authentication/AuthenticationHelper');

var genSQLFromItemList = (listingItemList, listingID) => {
    let itemListString = ''
    listingItemList.forEach((item, index) => {
        if (index !== 0) {
            itemListString += ','
        }

        itemListString += arrayToSQL([item.itemID, listingID, item.name, item.description])
    })

    return itemListString
}


var arrayToSQL = (arr) => {
    //// converts an array to an SQL insertable format String
    let finalString = '('
    arr.forEach((item, index) => {
        if (index !== 0) {
            finalString += ' ,'
        }
        finalString += `"${item}"`
    })
    finalString += ')'
    return finalString

};



module.exports.getListing = (req) => new Promise((resolve, reject) => {
    //// pulls a Listing entry from databse given listingID

    req.db.query(`SELECT *
                FROM listing
                WHERE listingID = '${req.body.listingID}'`, (error, results) => {
        if (error) {
            req.error = error
            req.error.details = 'select listing'
            reject(req)
        } else if (results[0]) {
            req.listing = results[0]
            req.listing.isActive = req.listing.isActive == 1 ? true : false
            console.log("Fetched Main Listing")
            resolve(req)
        } else {
            req.error = new Error('no listing found')
            req.error.details = 'no listing found'
            reject(req)
        }

    })
});

module.exports.getUserListings = (req) => new Promise((resolve, reject) => {
    //// pulls a Listing entry from databse given listingID

    req.db.query(`SELECT *
                FROM listing
                WHERE listingID = '${req.body.listingID}'
                AND authorID = '${req.userData.userID}'`, (error, results) => {
        if (error) {
            req.error = error
            req.error.details = 'select listing'
            reject(req)
        } else if (results[0]) {
            req.listing = results[0]
            req.listing.isActive = req.listing.isActive == 1 ? true : false
            console.log("Fetched Main Listing")
            resolve(req)
        } else {
            req.error = new Error('no listing found')
            req.error.details = 'no listing found'
            reject(req)
        }

    })
});

module.exports.getListingItems = (req) => new Promise((resolve, reject) => {
    //// pulls every item associated with a listingID from database

    req.db.query(`SELECT *
                FROM listing_item WHERE listingID = '${req.body.listingID}'
                `, (error, results) => {
        if (error) {
            req.error = error
            req.error.details = 'listing fetch error'
            reject(req)
        } else if (results[0]) {
            req.listing.itemList = results
            console.log("Fetched Listing Items")
            resolve(req)
        } else {
            req.error = new Error('no listing items found')
            reject(req)
        }
    })

});

module.exports.getListingItemTags = (req) => new Promise((resolve, reject) => {

    let sql = `SELECT * FROM tags
    JOIN (SELECT tagID,listingItemID
        FROM listing_item_tags
        WHERE listingID  = ?) AS itemFilteredTags
    ON tags.tagID = itemFilteredTags.tagID`

    req.db.query(sql, req.listing.listingID, (error, results) => {
        if (error) {
            req.error = error
            req.error.details = 'listing Tag fetch error'
            reject(req)
        } else if (results[0]) {
            //matches tagIds to listings using listing item id

            req.listing.itemList = req.listing.itemList.map((item) => {
                item.tagList = []
                results.filter((tagIDpair) => {
                    if (tagIDpair.listingItemID == item.listingItemID) {
                        item.tagList.push(tagIDpair.tagName)
                        return false
                    } else { return true }
                })
                return item
            })
            console.log("Fetched Listing Item Tags")
            resolve(req)
        } else {
            req.error = new Error('no listing tags found')
            reject(req)
        }
    })
});

//#################################################################################
module.exports.getListingItemImages = (req) => new Promise((resolve, reject) => {
    console.log("Fetched Listing Item Images")
    resolve(req)
});

module.exports.saveViewRequest = (req) => new Promise((resolve, reject) => {
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
                    console.log("View Succesfully loged")
                    resolve(req)
                }
            })
        })
    } else { resolve(req) }
});

module.exports.saveUserPromise = (req) => new Promise((resolve, reject) => {
    req.userData = req.body
    Auth.genID((userID) => {
        req.userData.userID = userID
        req.db.query(`INSERT INTO user_profile
                (userID, fName, lName, email, phone)
                VALUES ('${req.userData.userID}','${req.userData.first_name}','${req.userData.last_name}','${req.userData.email}',${req.userData.phone})`,
            (error, result) => {
                if (error) {
                    req.error = error
                    req.error.details = 'User save'
                    reject(req)
                } else {
                    console.log('main User Saved')
                    resolve(req)
                }
            })
    });
});

module.exports.insertMainListing = (req) => new Promise((resolve, reject) => {
    db = req.db
    Auth.genID((idOne) => {
        var {
            title,
            body,
            end_date,
            location,
            mainPhoto
        } = req.body

        var listingID = idOne
        var authorID = req.userData.userID

        req.listingID = listingID

        db.query(`INSERT INTO listing
        (listingID, authorID, title, body, mainPhoto, end_date, location)
        VALUES ('${listingID}','${authorID}','${title}','${body}','${mainPhoto}','${end_date}','${location}')`,
            (error) => {
                if (error) {
                    req.error = error
                    req.error.details = "main Save Error"
                    reject(req)
                } else {
                    resolve(req)
                }
            }
        )
    })
})

module.exports.insertListingItems = (req) => new Promise((resolve, reject) => {
    db = req.db
    listingID = req.listingID
    itemList = req.body.item_list

    itemList.map((item) => {
        Auth.genID((newID) => {
            item.itemID = newID;
            return item
        })
    })

    req.body.item_list = itemList //// saves itemlist with item ids for other functions

    db.query(`INSERT INTO listing_item (listingItemID, listingID, name, description) VALUES ${genSQLFromItemList(itemList, listingID)}`, (error) => {
        if (error) {
            req.error = error
            req.error.details = "item Save Error"
            reject(req)
        } else {
            resolve(req)
        }
    })
})

////////////////////////////////
module.exports.insertNewTags = (req) => new Promise((resolve, reject) => {
    itemList = req.body.item_list

    let tagSet = new Set();

    itemList.forEach((item) => {
        item.tags.forEach((tag) => {
            tagSet.add(tag)
        })
    })

    let nestedTagArr = [Array.from(tagSet).map((item) => { return [item] })]
    // if tag doesent exist, insert it
    let sql = `INSERT IGNORE INTO tags (tagName) VALUES ${genSQLFromNestedList(nestedTagArr)}`
    req.db.query(sql, (error, result) => {
        if (error) {
            req.error = error
            reject(req)
        } else {
            resolve(req)
        }
    })
})


module.exports.insertItemTags = (req) => new Promise((resolve, reject) => {
    itemList = req.body.item_list

    itemList = itemList.map((item) => {
        return item.tags.map((tag) => {
            return [tag, item.itemID, req.listingID]
        })
    })

    db.query(`INSERT INTO listing_item_tags (TagID,listingItemID,listingID) VALUES ${genSQLFromNestedList(itemList)}`, (error) => {
        if (error) {
            req.error = error
            req.error.details = "tag Save Error"
            reject(req)
        } else {
            resolve(req)
        }
    })
})

module.exports.saveImage_ReplacebyID = (req) => new Promise((resolve, reject) => {
    db = req.db
    itemList = req.body.item_list
})

module.exports.insertImageIds = (req) => new Promise((resolve, reject) => {
    db = req.db
    itemList = req.body.item_list

    itemList = itemList.map((item) => {
        return item.images.map((image) => {
            return [image, item.itemID]
        })
    })

    db.query(`INSERT INTO listing_item_images (imageID,listingItemID) VALUES ${genSQLFromNestedList(itemList)}`, (error) => {
        if (error) {
            req.error = error
            req.error.details = "image Save Error"
            reject(req)
        } else {
            resolve(req)
        }
    })

})

module.exports.deleteListing = (req) => new Promise((resolve, reject) => {
    req.db.query(`DELETE FROM listing WHERE listingID = '${req.listingID}'`, (error) => {
        if (error) {
            req.error = error
            req.error.details = "listing delete Error"
            reject(req)
        } else {
            resolve(req)
        }
    })
})