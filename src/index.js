'use strict';

var Alexa = require('alexa-sdk');
var Wikia = require('node-wikia');
var wiki = new Wikia("elite-dangerous"); //Define wikia site (subdomain)
var APP_ID = undefined; // TODO replace with your app ID (OPTIONAL).
var articleIds = require('./articleIds');
var articleImageSrcs = require('./imageSrcs');
var articlesWithSubpages = require('./articlesWithSubpages');

var articleName = "";
var articleWithSubpageName = "";
var subpageName = "";
var sectionName = "";

exports.handler = function(event, context, callback) {
    var alexa = Alexa.handler(event, context);
    alexa.APP_ID = APP_ID;
    // To enable string internationalization (i18n) features, set a resources object.
    //alexa.dynamoDBTableName = "wikiUsersED";
    alexa.resources = languageStrings;
    alexa.registerHandlers(handlers);
    alexa.execute();
};

var handlers = {
    'LaunchRequest': function () {
        console.log("Launch");
        this.attributes['speechOutput'] = this.t("WELCOME_MESSAGE", this.t("SKILL_NAME"));
        this.attributes['repromptSpeech'] = this.t("WELCOME_REPROMPT");
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech'])
    },
    'UnrecognizedIntent': function () {
        console.log("Unrecognized");
        this.attributes['speechOutput'] = this.t("HELP_MESSAGE");
        this.attributes['repromptSpeech'] = this.t("HELP_REPROMPT");
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech'])
    },
    'MoreInfoIntent': function () { //More information on topic
        console.log("More Info");
        var articleId = this.attributes['articleId'];

        if(typeof articleId != 'undefined'){
            this.attributes['articleSectionCurrent'] = this.attributes['articleSectionCurrent'] + 1;

            var sectionCurrent = this.attributes['articleSectionCurrent'];
            var articleSectionsWithContent = this.attributes['articleSectionsWithContent'];

            var sectionCurrentContent = [];

            var contextThis = this;

            if(typeof articleSectionsWithContent[sectionCurrent] != 'undefined'){
                this.attributes['cardNameSection'] = articleSectionsWithContent[sectionCurrent].title;
                wiki.getArticleAsSimpleJson(articleId)
                    .then(function(data) {
                        var article = data;
                        var sectionInfo = article.sections[articleSectionsWithContent[sectionCurrent].section];
                        for(var content in sectionInfo.content){
                            var titleWorking = sectionInfo.title;
                            sectionCurrentContent.push(sectionInfo.content[content]);
                        }
                        speechBuilder(contextThis,sectionCurrent,sectionCurrentContent,articleSectionsWithContent,false);
                    })
                    .fail(function(err) {
                        console.log("Error: " + err);
                        var speechOutput = contextThis.t("I'm having trouble connecting. Please try again later...");
                        contextThis.emit(':tell', speechOutput);
                    }
                );
            } else {
                this.attributes['speechOutput'] = this.t("INFO_END", this.attributes['cardNameMain']);
                this.attributes['repromptSpeech'] = this.t("INFO_CONTINUE_END");
                this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech']);
            }
        } else {
            this.attributes['speechOutput'] = "First, you will need to give me an article to look up. You can do so now.";
            this.attributes['repromptSpeech'] = this.t("INFO_CONTINUE_END");
            this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech']);
        }
    },
    'GetInfoIntent': function () { //Get info on topic
        console.log("Get Info");
        var articleSlot = this.event.request.intent.slots.Article;
        var articleWithSubpageSlot = this.event.request.intent.slots.ArticleWithSubpage;
        var subpageSlot = this.event.request.intent.slots.Subpage;
        var sectionSlot = this.event.request.intent.slots.Section;
        articleName = "";
        articleWithSubpageName = "";
        subpageName = "";
        sectionName = "";
        var articleDefined = false;
        var articleWithSubpageDefined = false;
        var subpageDefined = false;
        var sectionDefined = false;

        if (articleSlot && articleSlot.value) {
            articleName = articleSlot.value.toLowerCase();
            if(articleName){
                articleDefined = true;
            }
        }
        if (articleWithSubpageSlot && articleWithSubpageSlot.value) {
            articleWithSubpageName = articleWithSubpageSlot.value.toLowerCase();
            if(articleWithSubpageName){
                articleWithSubpageDefined = true;
            }
        }
        if (subpageSlot && subpageSlot.value) {
            subpageName = subpageSlot.value.toLowerCase();
            if(subpageName){
                subpageDefined = true;
            }
        }
        if (sectionSlot && sectionSlot.value) {
            sectionName = sectionSlot.value.toLowerCase();
            if(sectionName){
                sectionDefined = true;
            }
        }

        console.log(articleName);
        console.log(articleWithSubpageName);
        console.log(subpageName);
        console.log(sectionName);

        console.log(articleDefined);
        console.log(articleWithSubpageDefined);
        console.log(subpageDefined);
        console.log(sectionDefined);

        if(articleDefined || articleWithSubpageDefined) {
            console.log("Article and/or Article With Subpage Defined");
            var articles = articleIds;
            var articlesWithSubpage = this.t("ARTICLES_WITH_SUBPAGES");


            //Main Artice and Subpage FIX FROM LOGS
            if(articleWithSubpageDefined && subpageDefined && !sectionDefined && !articleDefined) {
                console.log("Main Artice and Subpage");
                if(typeof articlesWithSubpage[articleWithSubpageName] != 'undefined' && typeof articlesWithSubpage[articleWithSubpageName].subpages[subpageName] != 'undefined'){
                    var article;
                    var contextThis = this;
                    try{
                        var id = articlesWithSubpage[articleWithSubpageName].subpages[subpageName].id;
                        articleWithoutStartSection(article,contextThis,id);
                    } catch (e) {
                        console.log("Error: " + e);
                        var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    }
                } else {
                    if(typeof articlesWithSubpage[articleWithSubpageName] == 'undefined'){
                        var speechOutput = "I could not find the article, " +articleWithSubpageName+ ". ";
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    } else if(typeof articlesWithSubpage[articleWithSubpageName].subpages[subpageName] == 'undefined'){
                        var speechOutput = "The article, "+articleWithSubpageName+", does not contain the subpage, " + subpageName + ". ";
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    } else {
                        var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    }
                }
            //Main Artice, subpage, and section
            } else if(articleWithSubpageDefined && subpageDefined && sectionDefined && !articleDefined) {
                console.log("Main Artice, subpage, and section");
                if(typeof articlesWithSubpage[articleWithSubpageName] != 'undefined' && typeof articlesWithSubpage[articleWithSubpageName].subpages[subpageName] != 'undefined' && articlesWithSubpage[articleWithSubpageName].subpages[subpageName].sections.indexOf(sectionName) > -1){
                    var article;
                    var contextThis = this;
                    try{
                        var id = articlesWithSubpage[articleWithSubpageName].subpages[subpageName].id;
                        articleWithStartSection(article,contextThis,id,sectionName);
                    } catch (e) {
                        console.log("Error: " + e);
                        var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    }
                } else {
                    if(typeof articlesWithSubpage[articleWithSubpageName] == 'undefined'){
                        var speechOutput = "The article, " +articleWithSubpageName+ ", does not have any subpages. ";
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    } else if(typeof articlesWithSubpage[articleWithSubpageName].subpages[subpageName] == 'undefined'){
                        var speechOutput = "The article, " +articleWithSubpageName+ ", does not have the subpage, "+subpageName+". ";
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    } else if(articlesWithSubpage[articleWithSubpageName].subpages[subpageName].sections.indexOf(sectionName) < 0){
                        var speechOutput = "The subpage, "+subpageName+", does not contain the section, " + sectionName + ". ";
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    } else {
                        var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    }
                }
                
            //Main article and section
            } else if(!articleWithSubpageDefined && !subpageDefined && sectionDefined && articleDefined) {
                console.log("Main article and section");
                if(typeof articles[articleName] != 'undefined' && articles[articleName].sections.indexOf(sectionName) > -1){
                    var article;
                    var contextThis = this;
                    try{
                        var id = articles[articleName].id;
                        articleWithStartSection(article,contextThis,id);
                    } catch (e) {
                        console.log("Error: " + e);
                        var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    }
                } else {
                    if(typeof articles[articleName] == 'undefined'){
                        var speechOutput = "I could not find the article, " +articleName+ ". ";
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    } else if(articles[articleName].sections.indexOf(sectionName) < 0){
                        var speechOutput = "The article, "+articleName+", does not contain the section, " + sectionName + ". ";
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    } else {
                        var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    }
                }
                
                
            //Main article only
            } else if(!articleWithSubpageDefined && !subpageDefined && !sectionDefined && articleDefined) {
                console.log("Main article only");
                if(typeof articles[articleName] != 'undefined') {
                    var article;
                    var contextThis = this;
                    try{
                        var id = articles[articleName].id;
                        articleWithoutStartSection(article,contextThis,id);
                    } catch (e) {
                        console.log("Error: " + e);
                        var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    }
                } else {
                    if(typeof articles[articleName] == 'undefined'){
                        var speechOutput = "I could not find the article, " +articleName+ ". ";
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    } else {
                        var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
                        console.log(speechOutput);
                        var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                        speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                        speechOutput += repromptSpeech;
                        this.attributes['speechOutput'] = speechOutput;
                        this.attributes['repromptSpeech'] = repromptSpeech;
                        this.emit(':ask', speechOutput, repromptSpeech);
                    }
                }
            } else {
                console.log("Redundant Check -Something is really wrong if I showed up");
                var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
                var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
                speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                speechOutput += repromptSpeech;
                this.attributes['speechOutput'] = speechOutput;
                this.attributes['repromptSpeech'] = repromptSpeech;
                this.emit(':ask', speechOutput, repromptSpeech);
            }
        } else {
            console.log("Article and/or Article With Subpage NOT Defined");
            var speechOutput = this.t("INFO_NOT_FOUND_MESSAGE");
            var repromptSpeech = this.t("INFO_NOT_FOUND_REPROMPT");
            speechOutput += this.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
            speechOutput += repromptSpeech;
            this.attributes['speechOutput'] = speechOutput;
            this.attributes['repromptSpeech'] = repromptSpeech;
            this.emit(':ask', speechOutput, repromptSpeech);
        }
    },
    'AMAZON.HelpIntent': function () {
        console.log("Help");
        this.attributes['speechOutput'] = this.t("HELP_MESSAGE");
        this.attributes['repromptSpeech'] = this.t("HELP_REPROMPT");
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech']);
    },
    'AMAZON.RepeatIntent': function () {
        console.log("Repeat");
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech']);
    },
    'AMAZON.StopIntent': function () {
        console.log("Stop");
        this.emit('SessionEndedRequest');
    },
    'AMAZON.CancelIntent': function () {
        console.log("Cancel");
        this.emit('SessionEndedRequest');
    },
    'SessionEndedRequest':function () {
        console.log("Session Ended");
        this.emit(':tell', this.t("STOP_MESSAGE"));
    },
    'Unhandled': function () {
        console.log("Unhandled function");
        this.attributes['speechOutput'] = this.t("HELP_MESSAGE");
        this.attributes['repromptSpeech'] = this.t("HELP_REPROMPT");
        this.emit(':ask', this.attributes['speechOutput'], this.attributes['repromptSpeech'])
    }
};

//Use this for translations. Also edit to reflect the wiki you would like to query.
var languageStrings = {
    "en": {
        "translation": {
            "ARTICLES": articleIds,
            "ARTICLES_WITH_SUBPAGES": articlesWithSubpages,
            "SKILL_NAME": "Unofficial Elite Dangerous Wiki",
            "WELCOME_MESSAGE": "Welcome to %s. You can ask a question like, what\'s an asp explorer? ... Now, what can I help you with.",
            "WELCOME_REPROMPT": "For instructions on what you can say, please say help me.",
            "DISPLAY_CARD_TITLE": "%s",
            "HELP_MESSAGE": "You can ask questions such as, what is a pulse laser, or, you can say exit...Now, what can I help you with?",
            "HELP_REPROMPT": "You can say things like, what is a pulse laser, or you can say exit...Now, what can I help you with?",
            "STOP_MESSAGE": "Goodbye!",
            "INFO_END": "I do not have any more information for %s. You can ask about something else, or say quit to exit.",
            "INFO_CONTINUE": " To hear more, say continue.",
            "INFO_CONTINUE_END": "Try saying repeat, exit, or ask about something else.",
            "INFO_REPEAT_MESSAGE": "Try saying repeat, continue, or ask about something else.",
            "INFO_NOT_FOUND_MESSAGE": "I\'m sorry, I currently do not know any information on ",
            "INFO_NOT_FOUND_WITH_ITEM_NAME": "%s. ",
            "INFO_NOT_FOUND_WITHOUT_ITEM_NAME": "that. ",
            "INFO_NOT_FOUND_REPROMPT": "What else can I help with?"
        }
    },
    "en-US": {
        "translation": {
            "ARTICLES" : articleIds,
            "SKILL_NAME" : "Unofficial Elite: Dangerous Wiki: US Version"
        }
    },
    "en-GB": {
        "translation": {
            "ARTICLES": articleIds,
            "SKILL_NAME": "Unofficial Elite: Dangerous Wiki: UK Version"
        }
    }
};

function articleWithoutStartSection (article, contextThis, id) {
    wiki.getArticleAsSimpleJson(id)
        .then(function(data) {
            article = data;

            var sectionsWithContent = [];
            var sectionTitles = [];
            var sectionNum = 0;
            var futureSectionNum = 0;
            var sectionCurrentContent = [];
            for(var section in article.sections){
                var imageSrc = null;
                if(typeof article.sections[section].images[0] != "undefined") {
                    imageSrc = article.sections[section].images[0].src;
                }
                for(var content in article.sections[section].content){
                    if(content == 0) {
                        sectionNum = futureSectionNum;
                        futureSectionNum++;
                        var titleWorking = article.sections[section].title;
                        if(section == 0){
                            titleWorking = "Overview"
                        }
                        sectionsWithContent[sectionNum] = {
                            section: section,
                            title: titleWorking,
                            image: imageSrc
                        };
                    }
                    if(sectionNum == 0) {
                        sectionCurrentContent.push(article.sections[section].content[content]);
                    }
                }
            }
            if (typeof sectionCurrentContent[0] != "undefined") {
                contextThis.attributes['articleId'] = id;
                contextThis.attributes['articleSectionsWithContent'] = sectionsWithContent;
                contextThis.attributes['cardNameMain'] = article.sections[0].title;
                contextThis.attributes['articleSectionCurrent'] = 0;
                speechBuilder(contextThis,0,sectionCurrentContent,sectionsWithContent,true);
            } else {
                var speechOutput = contextThis.t("INFO_NOT_FOUND_MESSAGE");
                var repromptSpeech = contextThis.t("INFO_NOT_FOUND_REPROMPT");
                if (article.sections[0].title) {
                    speechOutput += contextThis.t("INFO_NOT_FOUND_WITH_ITEM_NAME", article.sections[0].title);
                } else {
                    speechOutput += contextThis.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
                }
                speechOutput += repromptSpeech;
                contextThis.attributes['speechOutput'] = speechOutput;
                contextThis.attributes['repromptSpeech'] = repromptSpeech;
                contextThis.emit(':ask', speechOutput, repromptSpeech);
            }
        })
        .fail(function(err) {
            console.log("Error: " + err);
            var speechOutput = "The section, "+ sectionName +", in the article, " +articleName+ ", does not contain any content. ";
            var repromptSpeech = contextThis.t("INFO_NOT_FOUND_REPROMPT");
            speechOutput += repromptSpeech;
            contextThis.attributes['speechOutput'] = speechOutput;
            contextThis.attributes['repromptSpeech'] = repromptSpeech;
            contextThis.emit(':ask', speechOutput, repromptSpeech);
        }
    );
}

function articleWithStartSection (article, contextThis, id) {
    wiki.getArticleAsSimpleJson(id)
        .then(function(data) {
            article = data;
            var sectionsWithContent = [];
            var sectionTitles = [];
            var sectionNum = 0;
            var futureSectionNum = 0;
            var sectionCurrentContent = [];
            var currentSection;
            for(var section in article.sections){
                var imageSrc = null;
                if(typeof article.sections[section].images[0] != "undefined") {
                    imageSrc = article.sections[section].images[0].src;
                }
                for(var content in article.sections[section].content){
                    if(content == 0) {
                        
                        var titleWorking = article.sections[section].title;
                        if(section == 0){
                            titleWorking = "Overview"
                        }
                        sectionsWithContent[sectionNum] = {
                            section: section,
                            title: titleWorking,
                            image: imageSrc
                        };
                        sectionNum = futureSectionNum;
                        futureSectionNum++;
                    }
                    if(article.sections[section].title.toLowerCase() == sectionName) {
                        sectionCurrentContent.push(article.sections[section].content[content]);
                        currentSection = sectionNum - 1;
                    }
                }
            }
            if (typeof sectionCurrentContent[0] != "undefined" && typeof currentSection != "undefined") {
                contextThis.attributes['articleId'] = id;
                contextThis.attributes['articleSectionsWithContent'] = sectionsWithContent;
                contextThis.attributes['cardNameMain'] = article.sections[0].title;
                contextThis.attributes['cardNameSection'] = article.sections[currentSection].title;
                contextThis.attributes['articleSectionCurrent'] = currentSection;
                speechBuilder(contextThis,currentSection,sectionCurrentContent,sectionsWithContent,false);
            } else {
                var speechOutput = "The section, "+ sectionName +", in the article, " +articleName+ ", does not contain any content. ";
                var repromptSpeech = contextThis.t("INFO_NOT_FOUND_REPROMPT");
                speechOutput += repromptSpeech;
                contextThis.attributes['speechOutput'] = speechOutput;
                contextThis.attributes['repromptSpeech'] = repromptSpeech;
                contextThis.emit(':ask', speechOutput, repromptSpeech);
            }
        })
        .fail(function(err) {
            var speechOutput = contextThis.t("INFO_NOT_FOUND_MESSAGE");
            var repromptSpeech = contextThis.t("INFO_NOT_FOUND_REPROMPT");
            if (articleName) {
                speechOutput += contextThis.t("INFO_NOT_FOUND_WITH_ITEM_NAME", articleName);
            } else {
                speechOutput += contextThis.t("INFO_NOT_FOUND_WITHOUT_ITEM_NAME");
            }
            speechOutput += repromptSpeech;
            contextThis.attributes['speechOutput'] = speechOutput;
            contextThis.attributes['repromptSpeech'] = repromptSpeech;
            contextThis.emit(':ask', speechOutput, repromptSpeech);
        }
    );
}

function speechBuilder(contextThis, sectionCurrent, sectionCurrentContent, sectionsWithContent, isStart){
    contextThis.attributes['repromptSpeech'] = contextThis.t("INFO_REPEAT_MESSAGE");
    var fullContent = "";
    contextThis.attributes['speechOutput'] = sectionsWithContent[sectionCurrent].title + ". ";

    if (isStart){
        var cardTitle = contextThis.t("DISPLAY_CARD_TITLE", contextThis.attributes['cardNameMain']);
    } else {
        var cardTitle = contextThis.t("DISPLAY_CARD_TITLE", contextThis.attributes['cardNameMain'] + ": " + contextThis.attributes['cardNameSection']);
    }
    
    for(var contentNum in sectionCurrentContent){
        if(sectionCurrentContent[contentNum].type == "paragraph"){
            contextThis.attributes['speechOutput'] += "<p>"+sectionCurrentContent[contentNum].text+"</p>";
            fullContent += sectionCurrentContent[contentNum].text + " \n ------------ \n ";
        } else if (sectionCurrentContent[contentNum].type == "list") {
            if(sectionCurrentContent[contentNum].elements.length > 0) {
                var workingSpeech = "";
                var workingContent = "";
                for(var listItem in sectionCurrentContent[contentNum].elements){
                    workingSpeech += "<p>"+sectionCurrentContent[contentNum].elements[listItem].text+"</p>"
                    workingContent += sectionCurrentContent[contentNum].elements[listItem].text + "\n";
                }
                contextThis.attributes['speechOutput'] = "To view this list, open your alexa app.";
                //contextThis.attributes['speechOutput'] = workingSpeech;
                fullContent = workingContent;
            } else {
                contextThis.attributes['speechOutput'] += "<p>There are no items in this list.</p>";
            }
        }
    }
    if(sectionsWithContent[sectionCurrent].image != null){
        if(sectionsWithContent[sectionCurrent].image.indexOf(".png") > -1 || sectionsWithContent[sectionCurrent].image.indexOf(".jpeg") > -1 || sectionsWithContent[sectionCurrent].image.indexOf(".jpg") > -1){
            var imageObj = {
                smallImageUrl: articleImageSrcs[sectionsWithContent[sectionCurrent].image].replace,
                largeImageUrl: articleImageSrcs[sectionsWithContent[sectionCurrent].image]
            };
            contextThis.emit(':askWithCard', contextThis.attributes['speechOutput'] + contextThis.t("INFO_CONTINUE"), contextThis.attributes['repromptSpeech'], cardTitle, fullContent,imageObj);
        } else {
            contextThis.emit(':askWithCard', contextThis.attributes['speechOutput'] + contextThis.t("INFO_CONTINUE"), contextThis.attributes['repromptSpeech'], cardTitle, fullContent);
        }
    } else {
        contextThis.emit(':askWithCard', contextThis.attributes['speechOutput'] + contextThis.t("INFO_CONTINUE"), contextThis.attributes['repromptSpeech'], cardTitle, fullContent);
    }
}