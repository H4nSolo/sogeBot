'use strict'

// 3rdparty libraries
var _ = require('lodash')
const debug = require('debug')('moderation')
// bot libraries
var constants = require('../constants')
var log = global.log

function Moderation () {
  this.lists = { blacklist: [], whitelist: [] }
  this.warnings = {}
  this.permits = []

  if (global.commons.isSystemEnabled(this)) {
    global.parser.register(this, '!permit', this.permitLink, constants.MODS)

    global.parser.registerParser(this, 'moderationLinks', this.containsLink, constants.VIEWERS)
    global.parser.registerParser(this, 'moderationSymbols', this.symbols, constants.VIEWERS)
    global.parser.registerParser(this, 'moderationLongMessage', this.longMessage, constants.VIEWERS)
    global.parser.registerParser(this, 'moderationCaps', this.caps, constants.VIEWERS)
    global.parser.registerParser(this, 'moderationSpam', this.spam, constants.VIEWERS)
    global.parser.registerParser(this, 'moderationColor', this.color, constants.VIEWERS)
    global.parser.registerParser(this, 'moderationEmotes', this.emotes, constants.VIEWERS)
    global.parser.registerParser(this, 'moderationBlacklist', this.blacklist, constants.VIEWERS)

    global.configuration.register('moderationLinks', 'core.settings.moderation.moderationLinks', 'bool', true)
    global.configuration.register('moderationLinksWithSpaces', 'core.settings.moderation.moderationLinksWithSpaces', 'bool', false)
    global.configuration.register('moderationLinksSubs', 'core.settings.moderation.moderationLinksSubs', 'bool', true)
    global.configuration.register('moderationLinksTimeout', 'core.settings.moderation.moderationLinksTimeout', 'number', 120)

    global.configuration.register('moderationSymbols', 'core.settings.moderation.moderationSymbols', 'bool', true)
    global.configuration.register('moderationSymbolsSubs', 'core.settings.moderation.moderationSymbolsSubs', 'bool', true)
    global.configuration.register('moderationSymbolsTimeout', 'core.settings.moderation.moderationSymbolsTimeout', 'number', 120)
    global.configuration.register('moderationSymbolsTriggerLength', 'core.settings.moderation.moderationSymbolsTriggerLength', 'number', 15)
    global.configuration.register('moderationSymbolsMaxConsecutively', 'core.settings.moderation.moderationSymbolsMaxConsecutively', 'number', 10)
    global.configuration.register('moderationSymbolsMaxPercent', 'core.settings.moderation.moderationSymbolsMaxPercent', 'number', 50)

    global.configuration.register('moderationLongMessage', 'core.settings.moderation.moderationLongMessage', 'bool', true)
    global.configuration.register('moderationLongMessageSubs', 'core.settings.moderation.moderationLongMessageSubs', 'bool', true)
    global.configuration.register('moderationLongMessageTimeout', 'core.settings.moderation.moderationLongMessageTimeout', 'number', 120)
    global.configuration.register('moderationLongMessageTriggerLength', 'core.settings.moderation.moderationLongMessageTriggerLength', 'number', 300)

    global.configuration.register('moderationCaps', 'core.settings.moderation.moderationCaps', 'bool', true)
    global.configuration.register('moderationCapsSubs', 'core.settings.moderation.moderationCapsSubs', 'bool', true)
    global.configuration.register('moderationCapsTimeout', 'core.settings.moderation.moderationCapsTimeout', 'number', 120)
    global.configuration.register('moderationCapsTriggerLength', 'core.settings.moderation.moderationCapsTriggerLength', 'number', 15)
    global.configuration.register('moderationCapsMaxPercent', 'core.settings.moderation.moderationCapsMaxPercent', 'number', 50)

    global.configuration.register('moderationSpam', 'core.settings.moderation.moderationSpam', 'bool', true)
    global.configuration.register('moderationSpamSubs', 'core.settings.moderation.moderationSpamSubs', 'bool', true)
    global.configuration.register('moderationSpamTimeout', 'core.settings.moderation.moderationSpamTimeout', 'number', 300)
    global.configuration.register('moderationSpamTriggerLength', 'core.settings.moderation.moderationSpamTriggerLength', 'number', 15)
    global.configuration.register('moderationSpamMaxLength', 'core.settings.moderation.moderationSpamMaxLength', 'number', 15)

    global.configuration.register('moderationColor', 'core.settings.moderation.moderationColor', 'bool', true)
    global.configuration.register('moderationColorSubs', 'core.settings.moderation.moderationColorSubs', 'bool', true)
    global.configuration.register('moderationColorTimeout', 'core.settings.moderation.moderationColorTimeout', 'number', 120)

    global.configuration.register('moderationEmotes', 'core.settings.moderation.moderationEmotes', 'bool', true)
    global.configuration.register('moderationEmotesSubs', 'core.settings.moderation.moderationEmotesSubs', 'bool', true)
    global.configuration.register('moderationEmotesTimeout', 'core.settings.moderation.moderationEmotesTimeout', 'number', 120)
    global.configuration.register('moderationEmotesMaxCount', 'core.settings.moderation.moderationEmotesMaxCount', 'number', 15)

    global.configuration.register('moderationBlacklistTimeout', 'core.settings.moderation.moderationBlacklistTimeout', 'number', 120)
    global.configuration.register('moderationBlacklistSubs', 'core.settings.moderation.moderationBlacklistSubs', 'bool', true)

    global.configuration.register('moderationWarnings', 'core.settings.moderation.moderationWarnings', 'number', 3)
    global.configuration.register('moderationAnnounceTimeouts', 'core.settings.moderation.moderationAnnounceTimeouts', 'bool', true)
    global.configuration.register('moderationWarningsTimeouts', 'core.settings.moderation.moderationWarningsTimeouts', 'bool', true)

    var self = this
    // purge warnings older than hour
    setInterval(function () {
      _.each(self.warnings, function (times, user) {
        let now = new Date().getTime()
        self.warnings[user] = _.filter(times, function (time) {
          return (now - parseInt(time, 10) < 3600000)
        })
        if (_.size(self.warnings[user]) === 0) delete self.warnings[user]
      })
    }, 60000)

    this._update(this)
    this.webPanel()
  }
}

Moderation.prototype._update = async function (self) {
  let blacklist = global.db.engine.findOne('settings', { key: 'blacklist' })
  let whitelist = global.db.engine.findOne('settings', { key: 'whitelist' })

  await blacklist
  await whitelist

  self.lists.blacklist = blacklist.value
  self.lists.whitelist = whitelist.value
}

Moderation.prototype.webPanel = function () {
  global.panel.addMenu({category: 'settings', name: 'moderation', id: 'moderation'})
  global.panel.socketListening(this, 'moderation.lists.get', this.emitLists)
  global.panel.socketListening(this, 'moderation.lists.set', this.setLists)
}

Moderation.prototype.emitLists = function (self, socket) {
  socket.emit('moderation.lists', self.lists)
}
Moderation.prototype.setLists = function (self, socket, data) {
  self.lists.blacklist = data.blacklist.filter(entry => entry.trim() !== '')
  self.lists.whitelist = data.whitelist.filter(entry => entry.trim() !== '')

  global.db.engine.update('settings', { key: 'blacklist' }, { value: self.lists.blacklist })
  global.db.engine.update('settings', { key: 'whitelist' }, { value: self.lists.whitelist })
}

Moderation.prototype.timeoutUser = function (self, sender, warning, msg, time) {
  var warningsAllowed = global.configuration.getValue('moderationWarnings')
  var warningsTimeout = global.configuration.getValue('moderationWarningsTimeouts')
  if (warningsAllowed === 0) {
    global.commons.timeout(sender.username, msg, time)
    return
  }

  let warnings = _.isUndefined(self.warnings[sender.username]) ? [] : self.warnings[sender.username]

  if (warnings.length >= warningsAllowed) {
    global.commons.timeout(sender.username, msg, time)
    delete self.warnings[sender.username]
    return
  }

  warnings.push(new Date().getTime())
  if (warningsTimeout) {
    global.commons.timeout(sender.username, warning.replace(/\$count/g, parseInt(warningsAllowed, 10) - warnings.length), 1)
  } else {
    global.commons.sendMessage('$sender: ' + warning.replace('$count', parseInt(warningsAllowed, 10) - warnings.length), sender)
  }

  self.warnings[sender.username] = warnings
}

Moderation.prototype.whitelist = function (text) {
  let ytRegex, clipsRegex

  // check if songrequest -or- alias of songrequest contain youtube link -> change it to ID
  if (global.commons.isSystemEnabled('songs')) {
    let alias = _.find(global.systems.alias.alias, function (oAlias) { return oAlias.command === 'songrequest' })
    if (!_.isUndefined(alias) && alias.enabled && global.commons.isSystemEnabled('alias')) {
      ytRegex = new RegExp('^(!songrequest|!' + alias.alias + ') \\S+(?:youtu.be\\/|v\\/|e\\/|u\\/\\w+\\/|embed\\/|v=)([^#&?]*).*', 'gi')
    } else {
      ytRegex = /^(!songrequest) \S+(?:youtu.be\/|v\/|e\/|u\/\w+\/|embed\/|v=)([^#&?]*).*/gi
    }
    text = text.replace(ytRegex, '')
  }

  clipsRegex = /.*(clips.twitch.tv\/)(\w+)/
  text = text.replace(clipsRegex, '')

  _.each(this.lists.whitelist, function (value) {
    text = text.replace(value, '')
  })

  return text
}

Moderation.prototype.permitLink = function (self, sender, text) {
  try {
    var parsed = text.match(/^@?([\u0500-\u052F\u0400-\u04FF\w]+) ?(\d+)?$/)
    let count = 1
    if (!_.isNil(parsed[2])) count = parseInt(parsed[2], 10)

    _.range(count).forEach(function () {
      self.permits.push(parsed[1].toLowerCase())
    })

    let m = global.commons.prepare('moderation.user-have-link-permit', { username: (global.configuration.getValue('atUsername') ? '@' : '') + parsed[1].toLowerCase(), link: global.parser.getLocalizedName(count, 'core.links'), count: count })
    debug(m); global.commons.sendMessage(m, sender)
  } catch (e) {
    global.commons.sendMessage(global.translate('moderation.permit-parse-failed'), sender)
  }
}

Moderation.prototype.containsLink = async function (self, id, sender, text, skip) {
  debug('containLinks(%s, %j, %s, %s', id, sender, text, skip)
  const isMod = await global.parser.isMod(sender)

  var timeout = global.configuration.getValue('moderationLinksTimeout')
  text = self.whitelist(text)

  debug('should check links - %s', global.configuration.getValue('moderationLinks'))
  debug('skip: %s', skip)
  debug('isOwner: %s', global.parser.isOwner(sender))
  debug('isMod: %s', isMod)
  debug('moderate with spaces: %s', global.configuration.getValue('moderationLinksWithSpaces'))
  if (skip || global.parser.isOwner(sender) || isMod || !global.configuration.getValue('moderationLinks') || (sender.subscriber && !global.configuration.getValue('moderationLinksSubs'))) {
    debug('checking links skipped')
    global.updateQueue(id, true)
    return
  }

  var urlRegex
  if (global.configuration.getValue('moderationLinksWithSpaces')) urlRegex = /[a-zA-Z0-9]+([a-zA-Z0-9-]+) ??\. ?(aero|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|sk|sl|sm|sn|so|sr|st|su|sv|sy|sz|tc|td|tf|tg|th|tj|tk|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|um|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zr|zw)\b/ig
  else urlRegex = /[a-zA-Z0-9]+([a-zA-Z0-9-]+)?\.(aero|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|ac|ad|ae|af|ag|ai|al|am|an|ao|aq|ar|as|at|au|aw|az|ba|bb|bd|be|bf|bg|bh|bi|bj|bm|bn|bo|br|bs|bt|bv|bw|by|bz|ca|cc|cd|cf|cg|ch|ci|ck|cl|cm|cn|co|cr|cs|cu|cv|cx|cy|cz|de|dj|dk|dm|do|dz|ec|ee|eg|eh|er|es|et|fi|fj|fk|fm|fo|fr|ga|gb|gd|ge|gf|gg|gh|gi|gl|gm|gn|gp|gq|gr|gs|gt|gu|gw|gy|hk|hm|hn|hr|ht|hu|id|ie|il|im|in|io|iq|ir|is|it|je|jm|jo|jp|ke|kg|kh|ki|km|kn|kp|kr|kw|ky|kz|la|lb|lc|li|lk|lr|ls|lt|lu|lv|ly|ma|mc|md|mg|mh|mk|ml|mm|mn|mo|mp|mq|mr|ms|mt|mu|mv|mw|mx|my|mz|na|nc|ne|nf|ng|ni|nl|no|np|nr|nu|nz|om|pa|pe|pf|pg|ph|pk|pl|pm|pn|pr|ps|pt|pw|py|qa|re|ro|ru|rw|sa|sb|sc|sd|se|sg|sh|si|sj|sk|sl|sm|sn|so|sr|st|su|sv|sy|sz|tc|td|tf|tg|th|tj|tk|tm|tn|to|tp|tr|tt|tv|tw|tz|ua|ug|uk|um|us|uy|uz|va|vc|ve|vg|vi|vn|vu|wf|ws|ye|yt|yu|za|zm|zr|zw)\b/ig

  if (text.search(urlRegex) >= 0) {
    if (_.includes(self.permits, sender.username.toLowerCase())) {
      _.pull(self.permits, sender.username.toLowerCase())
      global.updateQueue(id, true)
    } else {
      log.info(sender.username + ' [link] ' + timeout + 's timeout: ' + text)
      self.timeoutUser(self, sender,
        global.translate('moderation.user-is-warned-about-links'),
        global.translate('moderation.user-have-timeout-for-links'), timeout)
      global.updateQueue(id, false)
    }
  } else {
    global.updateQueue(id, true)
  }
}

Moderation.prototype.symbols = async function (self, id, sender, text, skip) {
  text = self.whitelist(text)

  const isMod = await global.parser.isMod(sender)

  var timeout = global.configuration.getValue('moderationSymbolsTimeout')
  var triggerLength = global.configuration.getValue('moderationSymbolsTriggerLength')
  var maxSymbolsConsecutively = global.configuration.getValue('moderationSymbolsMaxConsecutively')
  var maxSymbolsPercent = global.configuration.getValue('moderationSymbolsMaxPercent')

  var msgLength = text.trim().length
  var symbolsLength = 0

  if (skip || global.parser.isOwner(sender) || isMod || msgLength < triggerLength || !global.configuration.getValue('moderationSymbols') || (sender.subscriber && !global.configuration.getValue('moderationSymbolsSubs'))) {
    global.updateQueue(id, true)
    return
  }

  var out = text.match(/([^\s\u0500-\u052F\u0400-\u04FF\w]+)/g)
  for (var item in out) {
    if (out.hasOwnProperty(item)) {
      var symbols = out[item]
      if (symbols.length >= maxSymbolsConsecutively) {
        global.updateQueue(id, false)
        log.info(sender.username + ' [symbols] ' + timeout + 's timeout: ' + text)
        self.timeoutUser(self, sender,
          global.translate('moderation.user-is-warned-about-symbols'),
          global.translate('moderation.user-have-timeout-for-symbols'), timeout)
        return
      }
      symbolsLength = symbolsLength + symbols.length
    }
  }
  if (Math.ceil(symbolsLength / (msgLength / 100)) >= maxSymbolsPercent) {
    global.updateQueue(id, false)
    log.info(sender.username + ' [symbols] ' + timeout + 's timeout: ' + text)
    self.timeoutUser(self, sender, global.translate('moderation.warnings.symbols'), global.translate('moderation.symbols'), timeout)
    return
  }
  global.updateQueue(id, true)
}

Moderation.prototype.longMessage = async function (self, id, sender, text, skip) {
  text = self.whitelist(text)
  const isMod = await global.parser.isMod(sender)

  var timeout = global.configuration.getValue('moderationLongMessageTimeout')
  var triggerLength = global.configuration.getValue('moderationLongMessageTriggerLength')

  var msgLength = text.trim().length
  if (skip || global.parser.isOwner(sender) || isMod || msgLength < triggerLength || !global.configuration.getValue('moderationLongMessage') || (sender.subscriber && !global.configuration.getValue('moderationLongMessageSubs'))) {
    global.updateQueue(id, true)
  } else {
    global.updateQueue(id, false)
    log.info(sender.username + ' [longMessage] ' + timeout + 's timeout: ' + text)
    self.timeoutUser(self, sender,
      global.translate('moderation.user-is-warned-about-long-message'),
      global.translate('moderation.user-have-timeout-for-long-message'), timeout)
  }
}

Moderation.prototype.caps = async function (self, id, sender, text, skip) {
  debug('caps(%s, %j, %s, %s', id, sender, text, skip)
  text = self.whitelist(text)

  const isMod = await global.parser.isMod(sender)

  var emotesCharList = [] // remove emotes from caps checking
  _.each(sender['emotes'], function (emote) {
    _.each(emote, function (list) {
      _.each(_.range(parseInt(list.split('-')[0], 10), parseInt(list.split('-')[1], 10) + 1), function (val) {
        emotesCharList.push(val)
      })
    })
  })

  var timeout = global.configuration.getValue('moderationCapsTimeout')
  var triggerLength = global.configuration.getValue('moderationCapsTriggerLength')
  var maxCapsPercent = global.configuration.getValue('moderationCapsMaxPercent')

  var msgLength = text.trim().length
  var capsLength = 0

  debug('should check caps - %s', global.configuration.getValue('moderationLinks'))
  debug('skip: %s', skip)
  debug('isOwner: %s', global.parser.isOwner(sender))
  debug('isMod: %s', isMod)
  if (skip || global.parser.isOwner(sender) || isMod || msgLength < triggerLength || !global.configuration.getValue('moderationCaps') || (sender.subscriber && !global.configuration.getValue('moderationCapsSubs'))) {
    global.updateQueue(id, true)
    return
  }

  const regexp = /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,\-./:;<=>?@[\]^_`{|}~]/gi
  for (let i = 0; i < text.length; i++) {
    // if is emote or symbol - continue
    if (_.includes(emotesCharList, i) || !_.isNull(text.charAt(i).match(regexp))) {
      msgLength = parseInt(msgLength, 10) - 1
      continue
    }
    if (!_.isFinite(parseInt(text.charAt(i), 10)) && text.charAt(i).toUpperCase() === text.charAt(i) && text.charAt(i) !== ' ') capsLength += 1
  }

  debug('capped chars: %i', capsLength)
  debug('capped percent: %i%', Math.ceil(capsLength / (msgLength / 100)))
  if (Math.ceil(capsLength / (msgLength / 100)) >= maxCapsPercent) {
    global.updateQueue(id, false)
    log.info(sender.username + ' [caps] ' + timeout + 's timeout: ' + text)
    self.timeoutUser(self, sender,
      global.translate('moderation.user-is-warned-about-caps'),
      global.translate('moderation.user-have-timeout-for-caps'), timeout)
    return
  }
  global.updateQueue(id, true)
}

Moderation.prototype.spam = async function (self, id, sender, text, skip) {
  text = self.whitelist(text)

  const isMod = await global.parser.isMod(sender)

  var timeout = global.configuration.getValue('moderationSpamTimeout')
  var triggerLength = global.configuration.getValue('moderationSpamTriggerLength')
  var maxSpamLength = global.configuration.getValue('moderationSpamMaxLength')

  var msgLength = text.trim().length

  if (skip || global.parser.isOwner(sender) || isMod || msgLength < triggerLength || !global.configuration.getValue('moderationSpam') || (sender.subscriber && !global.configuration.getValue('moderationSpamSubs'))) {
    global.updateQueue(id, true)
    return
  }
  var out = text.match(/(.+)(\1+)/g)
  for (var item in out) {
    if (out.hasOwnProperty(item) && out[item].length >= maxSpamLength) {
      global.updateQueue(id, false)
      log.info(sender.username + ' [spam] ' + timeout + 's timeout: ' + text)
      self.timeoutUser(self, sender,
        global.translate('moderation.user-have-timeout-for-spam'),
        global.translate('moderation.user-is-warned-about-spam'), timeout)
      break
    }
  }
  global.updateQueue(id, true)
}

Moderation.prototype.color = async function (self, id, sender, text, skip) {
  const isMod = await global.parser.isMod(sender)

  var timeout = global.configuration.getValue('moderationColorTimeout')

  if (skip || global.parser.isOwner(sender) || isMod || !global.configuration.getValue('moderationColor') || (sender.subscriber && !global.configuration.getValue('moderationColorSubs'))) {
    global.updateQueue(id, true)
    return
  }

  if (sender['message-type'] === 'action') {
    global.updateQueue(id, false)
    log.info(sender.username + ' [color] ' + timeout + 's timeout: ' + text)
    self.timeoutUser(self, sender,
      global.translate('moderation.user-is-warned-about-color'),
      global.translate('moderation.user-have-timeout-for-color'), timeout)
  } else global.updateQueue(id, true)
}

Moderation.prototype.emotes = async function (self, id, sender, text, skip) {
  text = self.whitelist(text)
  const isMod = await global.parser.isMod(sender)

  var timeout = global.configuration.getValue('moderationSpamTimeout')
  var maxCount = global.configuration.getValue('moderationEmotesMaxCount')
  var count = 0

  if (skip || global.parser.isOwner(sender) || isMod || !global.configuration.getValue('moderationEmotes') || (sender.subscriber && !global.configuration.getValue('moderationEmotesSubs'))) {
    global.updateQueue(id, true)
    return
  }

  _.each(sender['emotes'], function (value, index) {
    count = count + value.length
  })

  if (count > maxCount) {
    global.updateQueue(id, false)
    log.info(sender.username + ' [emotes] ' + timeout + 's timeout: ' + text)
    self.timeoutUser(self, sender,
      global.translate('moderation.user-is-warned-about-emotes'),
      global.translate('moderation.user-have-timeout-for-emotes'), timeout)
  } else global.updateQueue(id, true)
}

Moderation.prototype.blacklist = async function (self, id, sender, text, skip) {
  const isMod = await global.parser.isMod(sender)
  if (skip || global.parser.isOwner(sender) || isMod || (sender.subscriber && !global.configuration.getValue('moderationBlacklistSubs'))) {
    global.updateQueue(id, true)
    return
  }

  var timeout = global.configuration.getValue('moderationBlacklistTimeout')
  _.each(self.lists.blacklist, function (value) {
    value = value.trim()
    if (text.indexOf(value) !== -1 && value.length > 0) {
      log.info(sender.username + ' [blacklist] ' + timeout + 's timeout: ' + text)
      self.timeoutUser(self, sender,
        global.translate('moderation.user-is-warned-about-blacklist'),
        global.translate('moderation.user-have-timeout-for-blacklist'), timeout)
      global.updateQueue(id, false)
      return false
    }
  })
  global.updateQueue(id, true)
}

module.exports = new Moderation()
