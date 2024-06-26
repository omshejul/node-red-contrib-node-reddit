module.exports = function (RED) {
  "use strict";

  const mustache = require("mustache");
  const snoowrap = require("snoowrap");
  const snoostorm = require("snoostorm-es6");

  // disable escaping
  mustache.escape = function (text) {
    return text;
  };

  function copyPropertiesExceptMethods(newArr, originalArr, msg) {
    for (var i = 0; i < originalArr.length; i++) {
      var clonedMsg = RED.util.cloneMessage(msg);
      clonedMsg.payload = JSON.parse(JSON.stringify(originalArr[i]));
      newArr.push(clonedMsg);
    }
  }

  // Check for mustache syntax
  function parseField(msg, nodeProp) {
    var field = null;
    var isTemplatedField = (nodeProp || "").indexOf("{{") != -1;
    if (isTemplatedField) {
      field = mustache.render(nodeProp, msg);
    } else {
      field = nodeProp;
    }

    return field;
  }

  function parseError(err) {
    var errorMsg;
    if (err.error && err.error.error && err.error.message) {
      errorMsg = err.error.error + " " + err.error.message;
    } else {
      errorMsg = "403 Forbidden";
    }

    return errorMsg;
  }

  // setup the credentials for each node
  function parseCredentials(n) {
    var config = RED.nodes.getNode(n.reddit);
    var credentials = config.credentials;
    var options = {
      userAgent: config.user_agent,
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
    };

    if (config.auth_type == "username_password") {
      options.username = config.username;
      options.password = credentials.password;
    } else if (config.auth_type == "refresh_token") {
      options.refreshToken = credentials.refresh_token;
    } else if (config.auth_type == "access_token") {
      options.accessToken = credentials.access_token;
    }

    return options;
  }

  function ConfigNode(n) {
    RED.nodes.createNode(this, n);
    this.username = n.username;
    this.user_agent = n.user_agent;
    this.auth_type = n.auth_type;
    this.name = n.name;
  }
  RED.nodes.registerType("reddit-credentials", ConfigNode, {
    credentials: {
      password: { type: "password" },
      client_id: { type: "password" },
      client_secret: { type: "password" },
      refresh_token: { type: "password" },
      access_token: { type: "password" },
    },
  });

  function GetNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    var options = parseCredentials(n);

    const r = new snoowrap(options);

    node.status({});
    node.on("input", function (msg) {
      node.status({ fill: "blue", shape: "dot", text: "loading" });

      var content_type = n.content_type;
      var subreddit = msg.subreddit || parseField(msg, n.subreddit);
      var user = parseField(msg, n.user);
      var submission_source = n.submission_source;
      var comment_source = n.comment_source;
      var pm_source = n.pm_source;
      var content_source = n.content_source;
      var sort = n.sort;
      var time = n.time;
      var limit = parseInt(n.limit);
      var depth = parseInt(n.depth);
      var content_id = parseField(msg, n.content_id);
      var fetch_all = n.fetch_all;

      var responseArr = [];
      if (content_type == "submission") {
        if (submission_source == "subreddit") {
          if (sort == "controversial") {
            r.getControversial(subreddit, { time: time, limit: limit })
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                var statusMsg =
                  subreddit == ""
                    ? "home/controversial"
                    : "r/" + subreddit + "/controversial";
                node.status({ fill: "green", shape: "dot", text: statusMsg });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          } else if (sort == "hot") {
            r.getHot(subreddit, { limit: limit })
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                // getHot returns n Reddit listings + number of stickied posts
                // this removes the extra posts so only n posts are returned
                if (!isNaN(limit)) {
                  var numStickies = responseArr.length - limit;
                  for (var i = 0; i < numStickies; i++) {
                    responseArr.pop();
                  }
                }
                var statusMsg =
                  subreddit == "" ? "home/hot" : "r/" + subreddit + "/hot";
                node.status({ fill: "green", shape: "dot", text: statusMsg });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          } else if (sort == "new") {
            r.getNew(subreddit, { limit: limit })
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                var statusMsg =
                  subreddit == "" ? "home/new" : "r/" + subreddit + "/new";
                node.status({ fill: "green", shape: "dot", text: statusMsg });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          } else if (sort == "rising") {
            r.getRising(subreddit, { limit: limit })
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                var statusMsg =
                  subreddit == ""
                    ? "home/rising"
                    : "r/" + subreddit + "/rising";
                node.status({ fill: "green", shape: "dot", text: statusMsg });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          } else if (sort == "top") {
            r.getTop(subreddit, { time: time, limit: limit })
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                var statusMsg =
                  subreddit == "" ? "home/top" : "r/" + subreddit + "/top";
                node.status({ fill: "green", shape: "dot", text: statusMsg });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          }
        } else if (submission_source == "user") {
          if (fetch_all == "true") {
            r.getUser(user)
              .getSubmissions()
              .fetchAll()
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                node.status({ fill: "green", shape: "dot", text: "u/" + user });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          } else {
            r.getUser(user)
              .getSubmissions({ limit: limit })
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                node.status({ fill: "green", shape: "dot", text: "u/" + user });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          }
        } else if (submission_source == "id") {
          r.getSubmission(content_id)
            .fetch()
            .then((response) => {
              msg.payload = JSON.parse(JSON.stringify(response));
              node.status({ fill: "green", shape: "dot", text: content_id });
              node.send(msg);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        }
      } else if (content_type == "comment") {
        if (comment_source == "subreddit") {
          r.getSubreddit(subreddit)
            .getNewComments({ limit: limit })
            .then((response) => {
              copyPropertiesExceptMethods(responseArr, response, msg);
              var statusMsg = subreddit == "" ? "home" : "r/" + subreddit;
              node.status({ fill: "green", shape: "dot", text: statusMsg });
              node.send([responseArr]);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (comment_source == "user") {
          if (fetch_all == "true") {
            r.getUser(user)
              .getComments()
              .fetchAll()
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                node.status({ fill: "green", shape: "dot", text: "u/" + user });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          } else {
            r.getUser(user)
              .getComments({ limit: limit })
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                node.status({ fill: "green", shape: "dot", text: "u/" + user });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          }
        } else if (comment_source == "submission") {
          if (fetch_all == "true") {
            limit = Infinity;
            depth = Infinity;
          }

          r.getSubmission(content_id)
            .expandReplies({ limit: limit, depth: depth })
            .then((response) => {
              copyPropertiesExceptMethods(responseArr, response.comments, msg);
              node.status({ fill: "green", shape: "dot", text: content_id });
              node.send([responseArr]);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (comment_source == "id") {
          r.getComment(content_id)
            .fetch()
            .then((response) => {
              msg.payload = JSON.parse(JSON.stringify(response));
              node.status({ fill: "green", shape: "dot", text: content_id });
              node.send(msg);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        }
      } else if (content_type == "pm") {
        if (pm_source == "inbox") {
          if (fetch_all == "true") {
            r.getInbox({ filter: "messages" })
              .fetchAll()
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                node.status({ fill: "green", shape: "dot", text: "inbox" });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          } else {
            r.getInbox({ limit: limit, filter: "messages" })
              .then((response) => {
                copyPropertiesExceptMethods(responseArr, response, msg);
                node.status({ fill: "green", shape: "dot", text: "inbox" });
                node.send([responseArr]);
              })
              .catch((err) => {
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          }
        } else if (pm_source == "id") {
          r.getMessage(content_id)
            .fetch()
            .then((response) => {
              msg.payload = JSON.parse(JSON.stringify(response));
              node.status({ fill: "green", shape: "dot", text: content_id });
              node.send(msg);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        }
      } else if (content_type == "content") {
        if (content_source == "saved") {
          r.getMe()
            .getSavedContent({ limit: limit })
            .then((response) => {
              copyPropertiesExceptMethods(responseArr, response, msg);
              node.status({ fill: "green", shape: "dot", text: "saved" });
              node.send([responseArr]);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (content_source == "upvoted") {
          r.getMe()
            .getUpvotedContent({ limit: limit })
            .then((response) => {
              copyPropertiesExceptMethods(responseArr, response, msg);
              node.status({ fill: "green", shape: "dot", text: "upvoted" });
              node.send([responseArr]);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (content_source == "downvoted") {
          r.getMe()
            .getDownvotedContent()
            .then((response) => {
              copyPropertiesExceptMethods(responseArr, response, msg);
              node.status({ fill: "green", shape: "dot", text: "downvoted" });
              node.send([responseArr]);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (content_source == "gilded") {
          r.getMe()
            .getGildedContent()
            .then((response) => {
              copyPropertiesExceptMethods(responseArr, response, msg);
              node.status({ fill: "green", shape: "dot", text: "gilded" });
              node.send([responseArr]);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (content_source == "hidden") {
          r.getMe()
            .getHiddenContent()
            .then((response) => {
              copyPropertiesExceptMethods(responseArr, response, msg);
              node.status({ fill: "green", shape: "dot", text: "hidden" });
              node.send([responseArr]);
            })
            .catch((err) => {
              var errorMsg = parseError(err);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        }
      }
    });
  }
  RED.nodes.registerType("get", GetNode);

  function ReplyNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    var options = parseCredentials(n);

    const r = new snoowrap(options);
    node.status({});
    node.on("input", function (msg) {
      var content_type = n.content_type;
      var content_id = parseField(msg, n.content_id);
      var text = parseField(msg, n.text);

      node.status({ fill: "blue", shape: "dot", text: content_type });

      var snoowrap_obj;
      if (content_type == "submission") {
        snoowrap_obj = r.getSubmission(content_id);
      } else if (content_type == "comment") {
        snoowrap_obj = r.getComment(content_id);
      } else if (content_type == "pm") {
        snoowrap_obj = r.getMessage(content_id);
      }

      snoowrap_obj
        .reply(text)
        .then((response) => {
          msg.payload = response;
          node.status({ fill: "green", shape: "dot", text: response.name });
          node.send(msg);
        })
        .catch(function (err) {
          var errorMsg = parseError(err);
          node.error(errorMsg, msg);
          node.status({ fill: "red", shape: "dot", text: "error" });
        });
    });
  }
  RED.nodes.registerType("reply", ReplyNode);

  function SearchNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    var options = parseCredentials(n);

    const r = new snoowrap(options);
    node.status({});
    node.on("input", function (msg) {
      var subreddit = parseField(msg, n.subreddit);
      var query = parseField(msg, n.query);
      var sort = n.sort;
      var time = n.time;
      var responseArr = [];

      var statusMsg = subreddit == "" ? "searching" : "r/" + subreddit;
      node.status({ fill: "blue", shape: "dot", text: statusMsg });

      r.getSubreddit(subreddit)
        .search({ query: query, sort: sort, time: time })
        .then((response) => {
          copyPropertiesExceptMethods(responseArr, response, msg);
          var statusMsg = subreddit == "" ? "success" : "r/" + subreddit;
          node.status({ fill: "green", shape: "dot", text: statusMsg });
          node.send([responseArr]);
        })
        .catch(function (err) {
          var errorMsg = parseError(err);
          node.error(errorMsg, msg);
          node.status({ fill: "red", shape: "dot", text: "error" });
        });
    });
  }
  RED.nodes.registerType("search", SearchNode);

  // create node

  function Create(n) {
    RED.nodes.createNode(this, n);

    var node = this;
    var options = parseCredentials(n);

    const r = new snoowrap(options);

    node.status({});

    node.on("input", (msg) => {
      node.status({ fill: "blue", shape: "dot", text: "submitting" });
      // parse user input
      var submissionType = n.submissionType;
      var subreddit = parseField(msg, n.subreddit);
      var title = parseField(msg, n.title);
      var url = parseField(msg, n.url);
      var text = parseField(msg, n.text);
      var original = parseField(msg, n.original);
      var recipient = parseField(msg, n.recipient);
      var subject = parseField(msg, n.subject);
      var message = parseField(msg, n.message);

      // show the correct status message
      var statusMessage;

      if (submissionType === "pm") {
        statusMessage = "sending";
      } else {
        statusMessage = "submitting";
      }

      node.status({ fill: "blue", shape: "dot", text: statusMessage });

      // prepare submission
      var snooCall;

      if (submissionType === "self") {
        snooCall = r.submitSelfpost({
          subredditName: subreddit,
          title: title,
          text: text,
        });
      } else if (submissionType === "link") {
        snooCall = r.submitLink({
          subredditName: subreddit,
          title: title,
          url: url,
        });
      } else if (submissionType === "cross") {
        snooCall = r.submitCrosspost({
          title: title,
          originalPost: original,
          subredditName: subreddit,
        });
      } else if (submissionType === "pm") {
        snooCall = r.composeMessage({
          to: recipient,
          subject: subject,
          text: message,
        });
      }

      // submit
      snooCall
        .then((response) => {
          var responseMessage;
          if (response.name !== undefined) {
            responseMessage = response.name;
            msg.payload = response;
          } else {
            responseMessage = "PM sent";
            msg.payload = {
              recipient: recipient,
              subject: subject,
              message: message,
            };
          }
          node.status({
            fill: "green",
            shape: "dot",
            text: "success: " + responseMessage,
          });
          node.send(msg);
        })
        .catch((err) => {
          node.error(err);
          node.status({ fill: "red", shape: "dot", text: "error" });
        });
    });
  }
  RED.nodes.registerType("create", Create);

  // stream node

  function Stream(n) {
    RED.nodes.createNode(this, n);

    var errorFlag = false;
    var errorMsg = "Reddit's ratelimit has been exceeded.";
    var node = this;
    var options = parseCredentials(n);

    const r = new snoowrap(options);
    const s = new snoostorm(r);

    node.status({});

    var stream;

    node.on("input", () => {
      // determine the refresh rate
      var refreshRate = n.pollTime ? n.pollTime * 1000 : 2000;

      // begin displaying the stream counter
      var count = 0;
      node.status({ fill: "blue", shape: "dot", text: n.kind + ": " + count });

      // stream and update the stream counter
      if (n.kind === "submissions") {
        stream = s.Stream("submission", {
          subreddit: n.subreddit,
          pollTime: refreshRate,
          results: 100,
        });
      } else if (n.kind === "comments") {
        stream = s.Stream("comment", {
          subreddit: n.subreddit,
          pollTime: refreshRate,
          results: 100,
        });
      } else if (n.kind === "PMs") {
        stream = s.Stream("inbox", {
          pollTime: refreshRate,
          filter: n.filter,
          results: 25,
        });
      }

      // notify the user when item arrives
      stream.on("item", (item) => {
        node.send({ payload: item });
        count++;
        node.status({
          fill: "blue",
          shape: "dot",
          text: n.kind + ": " + count,
        });

        // for PMs only
        if (n.kind === "PMs" && n.markedAsRead) {
          item.markAsRead();
        }

        errorFlag = false;
      });

      // notify user of snoostream-es6 breaking the ratelimit
      stream.on("error", () => {
        if (!errorFlag) {
          node.error(errorMsg, {});
          node.status({
            fill: "red",
            shape: "dot",
            text: "ratelimit exceeded",
          });
          errorFlag = true;
        }
      });

      // notify the user when the stream ends
      stream.on("end", () => {
        node.status({
          fill: "green",
          shape: "dot",
          text: "complete: " + count + " " + n.kind,
        });
      });

      // stop streaming after optional user-provided timeout
      if (n.timeout !== "") {
        var timeout = parseInt(n.timeout, 10);
        if (!isNaN(timeout)) {
          setTimeout(() => {
            stream.emit("end");
          }, timeout * 1000);
        }
      }
    });

    // stop streaming if node deleted from flow
    node.on("close", () => {
      stream.emit("end");
    });

    // don't start streaming until we get user input
    if (n.kind === "PMs" || (n.kind !== "" && n.subreddit !== "")) {
      node.emit("input", {});
    }
  }
  RED.nodes.registerType("stream", Stream);

  /***** Edit Node *****/
  function EditContent(n) {
    RED.nodes.createNode(this, n);
    //var config = RED.nodes.getNode(n.reddit);
    //var credentials = config.credentials;
    var node = this;
    var options = parseCredentials(n);

    const r = new snoowrap(options);
    node.status({});

    node.on("input", function (msg) {
      var content_type = n.content_type;
      var edit_content = parseField(msg, n.edit_content);
      var content_id = parseField(msg, n.content_id);

      if (content_type == "comment") {
        node.status({ fill: "blue", shape: "dot", text: "editing comment" });

        r.getComment(content_id)
          .edit(edit_content)
          .then((response) => {
            msg.payload = response.json.data.things[0];
            node.status({
              fill: "green",
              shape: "dot",
              text: "comment edited",
            });
            node.send(msg);
          })
          .catch(function (err) {
            var errorMsg = parseError(err);
            node.error(errorMsg, msg);
            node.status({ fill: "red", shape: "dot", text: "error" });
          });
      } else if (content_type == "submission") {
        node.status({ fill: "blue", shape: "dot", text: "editing submission" });

        r.getSubmission(content_id)
          .edit(edit_content)
          .then((response) => {
            msg.payload = response.json.data.things[0];
            node.send(msg);
            node.status({
              fill: "green",
              shape: "dot",
              text: "submission edited",
            });
          })
          .catch(function (err) {
            var errorMsg = parseError(err);
            node.error(errorMsg, msg);
            node.status({ fill: "red", shape: "dot", text: "error" });
          });
      }
    });
  }
  RED.nodes.registerType("edit", EditContent);

  /***** Delete Node *****/
  function DeleteContent(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    var options = parseCredentials(n);

    const r = new snoowrap(options);
    node.status({});
    node.on("input", function (msg) {
      var content_type = n.content_type;
      var content_id = parseField(msg, n.content_id);

      node.status({
        fill: "blue",
        shape: "dot",
        text: "deleting " + content_type,
      });

      var item;
      if (content_type == "comment") {
        item = r.getComment(content_id);
      } else if (content_type == "submission") {
        item = r.getSubmission(content_id);
      } else if (content_type == "private_message") {
        item = r.getMessage(content_id);
      }

      if (content_type == "comment") {
        item
          .fetch()
          .then((response) => {
            if ("[deleted]" === response.author.name) {
              var errorMsg = "403 Forbidden";
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            } else if (
              options.username.toLowerCase() !==
              response.author.name.toLowerCase()
            ) {
              var errorMsg = "403 Forbidden";
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            } else {
              response
                .delete()
                .then((deletedItem) => {
                  node.status({
                    fill: "green",
                    shape: "dot",
                    text: "comment deleted",
                  });
                })
                .catch((err) => {
                  var errorMsg = parseError(err);
                  node.error(errorMsg, msg);
                  node.status({ fill: "red", shape: "dot", text: "error" });
                });
            }
          })
          .catch((err) => {
            node.status({ fill: "red", shape: "dot", text: "error" });
            node.error("couldn't fetch item", msg);
          });
      } else if (content_type == "submission") {
        item
          .fetch()
          .then((response) => {
            if ("[deleted]" === response.author.name) {
              var errorMsg = "403 Forbidden";
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            } else if (
              options.username.toLowerCase() !==
              response.author.name.toLowerCase()
            ) {
              var errorMsg = "403 Forbidden";
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            } else {
              response
                .delete()
                .then((deletedItem) => {
                  node.status({
                    fill: "green",
                    shape: "dot",
                    text: "submission deleted",
                  });
                })
                .catch((err) => {
                  var errorMsg = parseError(err);
                  node.error(errorMsg, msg);
                  node.status({ fill: "red", shape: "dot", text: "error" });
                });
            }
          })
          .catch((err) => {
            node.status({ fill: "red", shape: "dot", text: "error" });
            node.error("couldn't fetch item", msg);
          });
      } else if (content_type == "private_message") {
        item
          .fetch()
          .then((response) => {
            response
              .deleteFromInbox()
              .then((deletedItem) => {
                //send deletedItem and update status
                msg.payload = deletedItem;
                node.send(msg);
                node.status({
                  fill: "green",
                  shape: "dot",
                  text: content_type + " deleted",
                });
              })
              .catch((err) => {
                //parseError, send it, and update status
                var errorMsg = parseError(err);
                node.error(errorMsg, msg);
                node.status({ fill: "red", shape: "dot", text: "error" });
              });
          })
          .catch((err) => {
            //parseError, send it, and update status
            var errorMsg = parseError(err);
            node.error(errorMsg, msg);
            node.status({ fill: "red", shape: "dot", text: "error" });
          });
      }
    });
  }
  RED.nodes.registerType("delete", DeleteContent);

  /***** React Node *****/
  function ReactContent(n) {
    RED.nodes.createNode(this, n);
    var node = this;
    var options = parseCredentials(n);

    const r = new snoowrap(options);
    node.status({});

    node.on("input", function (msg) {
      var content_type = n.content_type;
      var vote = n.vote;
      var save_value = n.save;
      var content_id = parseField(msg, n.content_id);

      if (content_type == "comment") {
        if (vote == "upvote") {
          node.status({ fill: "blue", shape: "dot", text: "upvoting comment" });
          r.getComment(content_id)
            .upvote()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "comment upvoted",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (vote == "downvote") {
          node.status({
            fill: "blue",
            shape: "dot",
            text: "downvoting comment",
          });
          r.getComment(content_id)
            .downvote()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "comment downvoted",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (vote == "unvote") {
          node.status({ fill: "blue", shape: "dot", text: "unvoting comment" });
          r.getComment(content_id)
            .unvote()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "comment un-voted",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        }

        if (save_value == "save") {
          node.status({ fill: "blue", shape: "dot", text: "saving comment" });
          r.getComment(content_id)
            .save()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "comment saved",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (save_value == "unsave") {
          node.status({ fill: "blue", shape: "dot", text: "unsaving comment" });
          r.getComment(content_id)
            .unsave()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "comment un-saved",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        }
      } else if (content_type == "submission") {
        if (vote == "upvote") {
          node.status({
            fill: "blue",
            shape: "dot",
            text: "upvoting submission",
          });
          r.getSubmission(content_id)
            .upvote()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "submission upvoted",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (vote == "downvote") {
          node.status({
            fill: "blue",
            shape: "dot",
            text: "downvoting submission",
          });
          r.getSubmission(content_id)
            .downvote()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "submission downvoted",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (vote == "unvote") {
          node.status({
            fill: "blue",
            shape: "dot",
            text: "unvoting submission",
          });
          r.getSubmission(content_id)
            .unvote()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "submission un-voted",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        }

        if (save_value == "save") {
          node.status({
            fill: "blue",
            shape: "dot",
            text: "saving submission",
          });
          r.getSubmission(content_id)
            .save()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "submission saved",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        } else if (save_value == "unsave") {
          node.status({
            fill: "blue",
            shape: "dot",
            text: "unsaving submission",
          });
          r.getSubmission(content_id)
            .unsave()
            .then((response) => {
              msg.payload = response;
              node.send(msg);
              node.status({
                fill: "green",
                shape: "dot",
                text: "submission un-saved",
              });
            })
            .catch(function (err) {
              var errorMsg = parseError(err);
              //console.log(errorMsg);
              node.error(errorMsg, msg);
              node.status({ fill: "red", shape: "dot", text: "error" });
            });
        }
      }
    });
  }
  RED.nodes.registerType("react", ReactContent);
};
