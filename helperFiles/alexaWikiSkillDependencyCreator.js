/* 
    Title: Alexa Wiki Skill Dependency Creator
    Author: Austin Wilson (17)
*/

'use strict';

//Require npm-packages
const https = require('https');
var Wikia = require('node-wikia');
var ProgressBar = require('progress');
var fs = require('fs');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var Spinner = require('cli-spinner').Spinner;
var async = require('asyncawait/async');
var await = require('asyncawait/await');
var colors = require('colors');

var wikiaSubdomain = "";

//var wiki = new Wikia("<your wiki subdomain>")'
var wiki = new Wikia(wikiaSubdomain);

//Global Variables
var useWikiImages = true; //Set to true to upload images to S3
var bucket = ""; //Set bucket to store images from Wikia

var contentData;
var allArticleTitles = [];
var allArticleIds = [];
var removedArticles = {};
var redirectArticles = [];
var imageUrlArray = {};
var rawUrlArray = [];
var allIds = [];
var duplicateArticleTitles = {};
var duplicateArticleTitlesFix = {};
var fixedArticleInfoJson = {};
var allArticles = {};
var articlesAndSubpages = {};
var articlesWithSubpages = "";
var allArticlesRawTxt = "";
var subpagesRawTxt = "";
var sectionsRawTxt = "";
var test = 0;
var imageUploadBar;
 
//Program start
var spinner = new Spinner('Fetching all wiki pages... This may take a while... %s');
spinner.setSpinnerString('|/-\\');
spinner.start();

var options = {
    "limit":	2500000 //Arbitrary number to fetch all articles from wiki
}

//Get all articles from wiki
wiki.getArticlesListExpanded(options)
        .then(function(data) {
            spinner.stop();
            console.log("\n");
            onCompletedAllArticlesGet(data); //Send data to "onCompletedAllArticlesGet"
        })
        .fail(function(err) {
            console.log(err);
    }
);

//Handle data from "getArticlesListExpanded"
function onCompletedAllArticlesGet(json) {
    //Uncomment to see all articles in a seperate file
    /*fs.writeFile('allArticles.json', JSON.stringify(json), 'utf-8', function (err) {
      if (err) throw err;
    });*/
    console.log('Fetched all articles \n'.blue);
    allArticles = json;
    for(var itemNum in json.items) { //Iterate through each article and find duplicate articles
        var workingJSON = json.items[itemNum];
        if(workingJSON.title.indexOf("/") > -1){ //If "/" found, take everything after "/" ("/" defines subpage)
            arrayCreator(workingJSON,workingJSON.title.substr(workingJSON.title.indexOf("/")+1)); //Send article title to "arrayCreator"
            allArticleIds[workingJSON.title.substr(workingJSON.title.indexOf("/")+1)] = { //Add to master list of article ids
                "id" : workingJSON.id
            };
        } else {
            arrayCreator(workingJSON,workingJSON.title); //Send article title to "arrayCreator"
            allArticleIds[workingJSON.title] = { //Add to master list of article ids
                "id" : workingJSON.id
            };
        }
    }
    //Uncomment to see all article in a seperate file
    /*fs.writeFile('articleIDs.json', JSON.stringify(allArticleIds), 'utf-8', function (err) {
      if (err) throw err;
      console.log('articleIDs.json created\n');
    });*/
    createMasterArticleIdList();
}

//Creates "duplicateArticleTitles" to store duplicate articles
function arrayCreator(json, title){
    if(allArticleTitles.indexOf(title) > -1){
        if(duplicateArticleTitles[title]){
            duplicateArticleTitles[title].id.push(json.id);
        } else {
            duplicateArticleTitles[title] = {
                "id": [json.id, allArticleIds[title].id]
            }
        }
    } else {
        allArticleTitles.push(title);
    }
    allIds.push(json.id);
}

//Creates the master id list by deleating all no-content articles and redirect articles
function createMasterArticleIdList() {
    //Vent all redirect articles from master id list
    var articleRedirectVent = async (function () {
        var len = Object.keys(allArticles.items).length;
        var workingJSON = allArticles;
        allArticles = {};
        redirectArticles = [];
        var green = '\u001b[42m \u001b[0m'; //Set Progress Bar color to green
        var bar = new ProgressBar('  Assosiating REDIRECT Articles [:bar] :percent      :current/:total     Elapsed: :elapseds Remaining: :etas', {
            complete: green,
            incomplete: ' ',
            width: 20,
            total: len
        });
        for(var itemNum in workingJSON.items) { //For each item in allArticles.items, determine if the id refrences a redirect article
            
            var optionsDetails = {
                "ids": [workingJSON.items[itemNum].id]
            }

            var removeOptions = {};

            removeOptions = await(wiki.getArticleDetails(optionsDetails)
                .then(function(json) {
                    for(var itemNumDetails in json.items) {
                        json = json.items[itemNumDetails];
                        if(json.abstract.indexOf("REDIRECT") > -1){
                            return {
                                remove: true,
                                redirectTo: json.abstract.replace("REDIRECT ", "")
                            };
                        } else {
                            return {
                                remove: false,
                                redirectTo: ""
                            };
                        }
                    }
                })
                .fail(function(err) {
                    console.log(err);
                }
            ));
            if(!removeOptions.remove) {
                allArticles[workingJSON.items[itemNum].title] = workingJSON.items[itemNum].id;
            } else {
                var optionsDetailsSearch = {
                    "query": removeOptions.redirectTo,
                    "limit": 1,
                    "minArticleQuality": 10
                }
                var redirectId = await(wiki.getSearchList(optionsDetailsSearch)
                    .then(function(json) {
                        if(typeof json.items[0] != "undefined"){
                            return json.items[0].id;
                        } else {
                            return null;
                        }
                    })
                    .fail(function(err) {
                        //console.log(err); //Supressed, because we want to return null if not found... Other errors will appear in main redirect call
                        return null;
                    }
                ));
                if(redirectId != null){
                    redirectArticles.push({
                        id: redirectId,
                        title: workingJSON.items[itemNum].title
                    });
                } else {
                    if(removedArticles[workingJSON.items[itemNum].title]){
                        removedArticles[workingJSON.items[itemNum].title].id.push(workingJSON.items[itemNum]);
                    } else {
                        removedArticles[workingJSON.items[itemNum].title] = {
                            "id": [workingJSON.items[itemNum]]
                        }
                    }
                }
            }
            bar.tick();
        }
        //Uncomment to see master redirectArticles list
        /*
        fs.writeFile('redirectArticles.json', JSON.stringify(redirectArticles), 'utf-8', function (err) {
            if (err) throw err;
            console.log('redirectArticles.json created\n');
        });
        */
        
    });
    //Vent all no-content articles from master id list  
    var articleNoContentVent = async (function () {
        var len = Object.keys(allArticles).length + Object.keys(redirectArticles).length;
        var workingJSONAllArticles = allArticles;
        var workingJSONRedirectArticles = redirectArticles;
        allArticles = {};
        redirectArticles = [];
        var green = '\u001b[42m \u001b[0m'; //Set Progress Bar color to green
        var bar = new ProgressBar('  Removing NO CONTENT Articles [:bar] :percent      :current/:total     Elapsed: :elapseds Remaining: :etas', {
            complete: green,
            incomplete: ' ',
            width: 20,
            total: len
        });
        var contentData;
        for(var itemName in workingJSONAllArticles) {
            var contentFound = false;
            contentFound = await(wiki.getArticleAsSimpleJson(workingJSONAllArticles[itemName]) //Was content found? If so, return true
                .then(function(data) {
                    contentData = data;
                    for(var secNum in data.sections){
                        for(var contentNum in data.sections[secNum].content){
                            if(data.sections[secNum].content[contentNum]){
                                if(data.sections[secNum].content[contentNum].text) {
                                    return true;
                                }
                            }
                        }
                        if(data.sections[secNum].content[0]) {
                            if(data.sections[secNum].content[0].text) {
                                return true;
                            }
                        }
                    }
                    return false;
                })
                .fail(function(err) {
                    console.log(err);
                }
            ));
            if(contentFound) { //If content was found, keep in master list
                allArticles[itemName] = workingJSONAllArticles[itemName];
            } else { //If no-content was found, remove from master list and add to "removedArticles"
                if(removedArticles[itemName]){
                    removedArticles[itemName].id.push(workingJSONAllArticles[itemName]);
                } else {
                    removedArticles[itemName] = {
                        "id": [workingJSONAllArticles[itemName]]
                    }
                }
            }
            bar.tick();
        }
        for(var itemNum in workingJSONRedirectArticles) {
            var contentFound = false;
            contentFound = await(wiki.getArticleAsSimpleJson(workingJSONRedirectArticles[itemNum].id) //Was content found? If so, return true
                .then(function(data) {
                    contentData = data;
                    for(var secNum in data.sections){
                        for(var contentNum in data.sections[secNum].content){
                            if(data.sections[secNum].content[contentNum]){
                                if(data.sections[secNum].content[contentNum].text) {
                                    return true;
                                }
                            }
                        }
                        if(data.sections[secNum].content[0]) {
                            if(data.sections[secNum].content[0].text) {
                                return true;
                            }
                        }
                    }
                    return false;
                })
                .fail(function(err) {
                    console.log(err);
                }
            ));
            if(contentFound) { //If content was found, keep in master list
                redirectArticles.push({
                    id: workingJSONRedirectArticles[itemNum].id,
                    title: workingJSONRedirectArticles[itemNum].title
                });
            } else { //If no-content was found, remove from master list and add to "removedArticles"
                if(removedArticles[workingJSONRedirectArticles[itemNum].title]){
                    removedArticles[workingJSONRedirectArticles[itemNum].title].id.push(workingJSONRedirectArticles[itemNum].id);
                } else {
                    removedArticles[workingJSONRedirectArticles[itemNum].title] = {
                        "id": [workingJSONRedirectArticles[itemNum].id]
                    }
                }
            }
            bar.tick();
        }
    });


    //Wait for "articleRedirectVent" to finish
    articleRedirectVent().then(function(){
        console.log('\nREDIRECT assosiation complete\n'.blue);
        //Wait for "articleNoContentVent" to finish
        articleNoContentVent().then(function(){
            console.log('\nNO CONTENT vent complete\n'.blue);
            //Uncomment to see master id list after vents
            /*
            fs.writeFile('afterNoContent.json', JSON.stringify(allArticles), 'utf-8', function (err) {
                if (err) throw err;
                console.log('afterNoContent.json created\n');
            });
            */
            articleRenamer();
        });
    });
}

//Rename all articles with "/" in name
function articleRenamer() {
    var articleNewNameFinder = async (function () {
        var workingJSON = allArticles;
        allArticles = {};
        var len = Object.keys(workingJSON).length + Object.keys(redirectArticles).length;
        var green = '\u001b[42m \u001b[0m'; //Set Progress Bar color to green
        var bar = new ProgressBar('  Renaming Articles [:bar] :percent     :current/:total     Elapsed: :elapseds Remaining: :etas', {
            complete: green,
            incomplete: ' ',
            width: 20,
            total: len
        });
        var contentData;
        var contentSections;
        var contentSectionNames = [];
        var title;
        for(var itemName in workingJSON) {
            contentSectionNames = [];
            title = await(wiki.getArticleAsSimpleJson(workingJSON[itemName])
                    .then(function(data) {
                        contentData = data.sections[0];
                        contentSections = data.sections;
                        if(contentData.title.indexOf("/") > -1){
                            return ["1", contentData.title];
                        } else {
                            return ["2", contentData.title];
                        }
                    })
                    .fail(function(err) {
                        console.log(err);
                }
            ));
            for(var sectionNum in contentSections) {
                if(sectionNum != 0){
                    if(!(sectionsRawTxt.indexOf("/n"+contentSections[sectionNum].title.toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim()+"/n") > -1)){
                        sectionsRawTxt += contentSections[sectionNum].title.toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim() + "\n";
                    }
                    contentSectionNames.push(contentSections[sectionNum].title.toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim());
                }
                if(typeof contentSections[sectionNum].images[0] != "undefined") {
                     var urlRaw = contentSections[sectionNum].images[0].src;
                     rawUrlArray.push(urlRaw);
                 }
            }
            switch(title[0]) {
                case "1":
                    if(!(articlesWithSubpages.indexOf(title[1].substr(0,contentData.title.indexOf("/")).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim()) > -1)){
                        articlesWithSubpages += title[1].substr(0,contentData.title.indexOf("/")).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim() + "\n";
                    }
                    if(articlesAndSubpages[title[1].substr(0,contentData.title.indexOf("/")).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim()]) {
                        var subPageTitle = title[1].substr(contentData.title.indexOf("/")+1).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim();
                        var subPageId = workingJSON[itemName];
                        var subPageInfo = {
                            "id": subPageId,
                            "sections": contentSectionNames
                        }
                        subpagesRawTxt += title[1].substr(contentData.title.indexOf("/")+1).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim() + "\n";
                        articlesAndSubpages[title[1].substr(0,contentData.title.indexOf("/")).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim()].subpages[subPageTitle] = subPageInfo;
                    } else {
                        var subPageTitle = title[1].substr(contentData.title.indexOf("/")+1).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim();
                        var subPageId = workingJSON[itemName];
                        var subPageInfo = {
                            "id": subPageId,
                            "sections": contentSectionNames
                        }
                        articlesAndSubpages[title[1].substr(0,contentData.title.indexOf("/")).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim()] = {
                            "subpages": {}
                        }
                        articlesAndSubpages[title[1].substr(0,contentData.title.indexOf("/")).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim()].subpages[subPageTitle] = subPageInfo;
                        subpagesRawTxt += title[1].substr(contentData.title.indexOf("/")+1).toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim() + "\n";
                    }
                    break;
                case "2":
                    allArticles[title[1].toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim()] = {
                        "id": workingJSON[itemName],
                        "sections": contentSectionNames
                    };
                    allArticlesRawTxt += title[1].toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim() + "\n";
                    break;
            }
            bar.tick();
        }
        for(var itemNum in redirectArticles) {
            contentSectionNames = [];
            title = await(wiki.getArticleAsSimpleJson(redirectArticles[itemNum].id)
                    .then(function(data) {
                        contentSections = data.sections;
                        return ["2", redirectArticles[itemNum].title];
                    })
                    .fail(function(err) {
                        console.log(err);
                }
            ));
            for(var sectionNum in contentSections) {
                if(sectionNum){
                    if(!(sectionsRawTxt.indexOf("/n"+contentSections[sectionNum].title.toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim()+"/n") > -1)){
                        sectionsRawTxt += contentSections[sectionNum].title.toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim() + "\n";
                    }
                    contentSectionNames.push(contentSections[sectionNum].title.toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim());
                }
            }
            allArticles[title[1].toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim()] = {
                "id": redirectArticles[itemNum].id,
                "sections": contentSectionNames
            };
            allArticlesRawTxt += title[1].toLowerCase().replace(/[^0-9a-z'&]/gi," ").replace(/ '/gi,"").replace(/' /gi,"").replace(/&/gi,"").replace(/amp/gi,"and").replace(/\s+/g,' ').trim() + "\n";
            bar.tick();
        }
    });
    articleNewNameFinder().then(function(){ //After renamer, create dependency files
        console.log('\nArticle Renaming complete\n'.blue);
        if(useWikiImages){
            uploadPics();
        } else {
            mergeMasterWithSubpages();
        }
    });
}

function uploadPics () {
    var green = '\u001b[42m \u001b[0m'; //Set Progress Bar color to green
    imageUploadBar = new ProgressBar('  Uploading Images to S3 [:bar] :percent      :current/:total     Elapsed: :elapseds Remaining: :etas', {
        complete: green,
        incomplete: ' ',
        width: 20,
        total: rawUrlArray.length
    });
    
    for(var urlWorking in rawUrlArray){
        indivPic(rawUrlArray[urlWorking]);
    }
}

function indivPic(url) {
    
    var compareString = "";

    if(url.indexOf("images") > -1){
        if(url.indexOf(".png") > -1){
            compareString = ".png";
        } else if(url.indexOf(".jpg") > -1){
            compareString = ".jpg";
        } else if(url.indexOf(".jpeg") > -1){
            compareString = ".jpeg";
        } else {
            test++;
            imageUploadBar.tick();
            if(test == rawUrlArray.length){
                console.log('\nImage uploading complete\n'.blue);
                mergeMasterWithSubpages();
            }
        }
    } else {
        test++;
        imageUploadBar.tick();
        if(test == rawUrlArray.length){
            console.log('\nImage uploading complete\n'.blue);
            mergeMasterWithSubpages();
        }
    }

    if(compareString != ""){
        var s3url = url.substring(url.indexOf('/', 8)+1,url.indexOf(compareString)+compareString.length);
        var paramsGet = {
            Bucket: bucket,
            Key: s3url
        };

        var headObjectPromise = s3.headObject(paramsGet).promise();
        headObjectPromise.then(function(data) {
            imageUrlArray[url] = "https://s3.amazonaws.com/" + bucket + "/" + s3url;
            test++;
            imageUploadBar.tick();
            if(test == rawUrlArray.length){
                console.log('\nImage uploading complete\n'.blue);
                mergeMasterWithSubpages();
            }
        }).catch(function(errGet) {
            if (errGet && errGet.code === 'NotFound') {
                https.get(url, function(res) {
                    var data = [];
                    res.on('data', function(chunk) {
                        data.push(chunk);
                    });
                    res.on('end', function() {
                        var buffer = Buffer.concat(data);
                        var base64data = new Buffer(buffer, 'binary');
                        var paramsPut = {
                            Bucket: bucket,
                            Key: s3url,
                            Body: base64data,
                            ACL: 'public-read'
                        }
                        var putObjectPromise = s3.putObject(paramsPut).promise();
                        putObjectPromise.then(function(data) {
                                imageUrlArray[url] = "https://s3.amazonaws.com/" + bucket + "/" + s3url;
                                test++;
                                imageUploadBar.tick();
                                if(test == rawUrlArray.length){
                                    console.log('\nImage uploading complete\n'.blue);
                                    mergeMasterWithSubpages();
                                }
                        }).catch(function(err) {
                            console.log(err);
                        });
                    });
                    res.on('error', function (e) {
                        console.log(e);
                    });
                });
            }
        });
    }
}

function mergeMasterWithSubpages() {
    var articlesWithSubpagesArray = articlesWithSubpages.split(/\r?\n/);
    var articlesWithSubpagesArrayUnique = articlesWithSubpagesArray.filter(function(item, pos, self) {
        return self.indexOf(item) == pos;
    });
    articlesWithSubpages = createString(articlesWithSubpagesArrayUnique);
    var allArticlesRawTxtArray = allArticlesRawTxt.split(/\r?\n/);
    var allArticlesRawTxtArrayUnique = allArticlesRawTxtArray.filter(function(item, pos, self) {
        return self.indexOf(item) == pos;
    });
    allArticlesRawTxt = createString(allArticlesRawTxtArrayUnique);
    var subpagesRawTxtArray = subpagesRawTxt.split(/\r?\n/);
    var subpagesRawTxtArrayUnique = subpagesRawTxtArray.filter(function(item, pos, self) {
        return self.indexOf(item) == pos;
    });
    subpagesRawTxt = createString(subpagesRawTxtArrayUnique);
    var sectionsRawTxtArray = sectionsRawTxt.split(/\r?\n/);
    var sectionsRawTxtArrayUnique = sectionsRawTxtArray.filter(function(item, pos, self) {
        return self.indexOf(item) == pos;
    });
    sectionsRawTxt = createString(sectionsRawTxtArrayUnique);
    
    var fileCreated = 0;
    fs.writeFile('articleIds.js', "module.exports = " + JSON.stringify(allArticles), 'utf-8', function (err) {
        if (err) {
            console.log('Unable to write articleIds.js'.red);
            throw err;
        }
        fileCreated++;
        if(fileCreated < 7) {
            done();
        }
    });
    
    fs.writeFile('imageSrcs.js', "module.exports = " + JSON.stringify(imageUrlArray), 'utf-8', function (err) {
        if (err) {
            console.log('Unable to write articleIds.js'.red);
            throw err;
        }
        fileCreated++;
        if(fileCreated < 7) {
            done();
        }
    });

    fs.writeFile('articlesWithSubpages.js', "module.exports = " + JSON.stringify(articlesAndSubpages), 'utf-8', function (err) {
        if (err) {
            console.log('Unable to write articlesWithSubpages.js'.red);
            throw err;
        }
        fileCreated++;
        if(fileCreated < 7) {
            done();
        }
    });
    fs.writeFile('speechAssets/LIST_OF_ARTICLES_WITH_SUBPAGES.txt', articlesWithSubpages, 'utf-8', function (err) {
        if (err) {
            console.log('Unable to write speechAssets/LIST_OF_ARTICLES_WITH_SUBPAGES.txt'.red);
            throw err;
        }
        fileCreated++;
        if(fileCreated < 7) {
            done();
        }
    });
    fs.writeFile('speechAssets/LIST_OF_ARTICLES.txt', allArticlesRawTxt, 'utf-8', function (err) {
        if (err) {
            console.log('Unable to write speechAssets/LIST_OF_ARTICLES.txt'.red);
            throw err;
        }
        fileCreated++;
        if(fileCreated < 7) {
            done();
        }
    });
    fs.writeFile('speechAssets/LIST_OF_SUBPAGES.txt', subpagesRawTxt, 'utf-8', function (err) {
        if (err) {
            console.log('Unable to write speechAssets/LIST_OF_SUBPAGES.txt'.red);
            throw err;
        }
        fileCreated++;
        if(fileCreated < 7) {
            done();
        }
    });
    fs.writeFile('speechAssets/LIST_OF_SECTIONS.txt', sectionsRawTxt, 'utf-8', function (err) {
        if (err) {
            console.log('Unable to write speechAssets/LIST_OF_SECTIONS.txt'.red);
            throw err;
        }
        fileCreated++;
        if(fileCreated < 7) {
            done();
        }
    });
}

function done() {
    console.log('articleIds.js created'.cyan);
    console.log('imageSrcs.js created'.cyan);
    console.log('articlesWithSubpages.js created'.cyan);
    console.log('speechAssets/LIST_OF_ARTICLES_WITH_SUBPAGES.txt created'.cyan);
    console.log('speechAssets/LIST_OF_ARTICLES.txt created'.cyan);
    console.log('speechAssets/LIST_OF_SUBPAGES.txt created'.cyan);
    console.log('speechAssets/LIST_OF_SECTIONS.txt created\n'.cyan);

    console.log('All Done'.yellow.bold);
    process.exit();
}

function createString(array) {
    var returnStr = "";
    for(var arrayTxtNum in array) {
        returnStr += array[arrayTxtNum] + "\n";
    }
    return returnStr;
}

