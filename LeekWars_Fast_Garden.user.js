// ==UserScript==
// @name        LeekWars Fast Garden
// @namespace   LeekWars.Garden
// @description Pour une gestion plus rapide des combats dans le potager.
// @include     http://leekwars.com/garden
// @version     0.1.0
// @grant       none
// ==/UserScript==


function getTitle(html) {
  var el = document.createElement('div');
  el.innerHTML = html;
  return el.getElementsByTagName('title')[0].text;
}

function getName(id) {
  return $('#' + id).html().match(/[<]{1}br>([^<]*)[<]{1}br>/)[1];
}

function decCount(id) {
  var counter = $('#'+id+' .fights');
  var count = counter.text().match(/[0-9-]+/)[0];
  counter[0].lastChild.nodeValue = ' ' + (count-1);
}

/* Override submitForm function */
unsafeWindow.submitForm = function(page, params){
  var realParams = {};
  for (var p in params) {
    realParams[params[p][0]] = params[p][1];
    console.log(params[p][0] + '=' + params[p][1]);
  }
  realParams.token = __TOKEN;
  var myId = realParams.leek_id || realParams.my_team || __FARMER_ID;
  var targetId = realParams.enemy_id || realParams.target_team || realParams.target_farmer;
  var name = getName(targetId);
  var fightType = FightTypeEnum.UNDEFINED;
  if (!!realParams.enemy_id) fightType = FightTypeEnum.SOLO;
  if (!!realParams.target_farmer) fightType = FightTypeEnum.FARMER;
  if (!!realParams.target_team) fightType = FightTypeEnum.TEAM;
  //vérifier si combat déjà lancé
  for (var i = 0; i < fights.length; i++) {
    if (fights[i].targetId == targetId) {
      //si terminé ouvrir le rapport dans un nouvel onglet, sinon ne rien faire
      if (fights[i].result != ResultEnum.UNDEFINED) {
        window.open('/report/' + fights[i].fightId, '_blank');
      }
      return;
    }
  }
  console.log('Lancement du combat contre ' + name + '...');
  $.post('/' + page, realParams, function (response) {
    var success = getTitle(response).toLowerCase().indexOf('combat') != - 1;
    console.log(name + ': ' + (success ? 'SUCCESS' : 'FAILED'));
    if (success && fightType != FightTypeEnum.UNDEFINED) {
      if (fightType == FightTypeEnum.SOLO) decCount('tab-solo');
      if (fightType == FightTypeEnum.FARMER) decCount('tab-farmer');
      if (fightType == FightTypeEnum.TEAM) decCount('tab-team');
      //récupération du fight id
      var i1 = response.indexOf("<script>var __ID");
      var i2 = response.indexOf("<\/script>", i1);
      var fightId = response.substring(i1+19, i2);
      console.log('fightId=' + fightId);
      var fight = { 'targetId':targetId, 'fightId':fightId, 'myId':myId, 'type':fightType, 'descTurns':null, 'result':ResultEnum.UNDEFINED };
      fights.push(fight);
    }
  });
  $.get('/garden');
}

function checkFightResult(fight)
{
  $.ajax({
        url: '/report/' + fight.fightId,
        type: 'GET',
        dataType: 'html',
        async: true,
        success: function(res) {
          if (fight.result != ResultEnum.UNDEFINED) {
            console.log("Combat déjà traité");
            return;
          }
          if (res.indexOf("Le combat n'est pas encore") != - 1) {
            console.log("Combat en cours de génération...");
            return;
          }
          var el = $('#' + fight.targetId)[0];
          var i1 = res.indexOf("<h3>Gagnants</h3>");
          var i2 = res.indexOf("<h3>Perdants</h3>");
          if (i1 == -1 || i2 == -1) {
            console.log("Egalité !");
            fight.result = ResultEnum.EQUALITY;
            if (el) el.style.backgroundColor = ColorEnum.EQUALITY;
            return;
          }
          var i3 = res.indexOf("<div id='duration'>") + 19;
          var i4 = res.indexOf("</div>", i3);
          var duration = res.substr(i3, i4 - i3);
          if (duration.indexOf('&') != -1)
            duration = $("<div/>").html(duration).text();
          console.log(duration);
          fight.descTurns = duration;
          var index = -1;
          if (fight.type == FightTypeEnum.SOLO)
            index = res.indexOf("<a href='/leek/" + fight.myId, i1);
          else if (fight.type == FightTypeEnum.FARMER)
            index = res.indexOf("<a href='/leek/" + myFirstLeekId, i1);
          else if (fight.type == FightTypeEnum.TEAM)
            index = res.indexOf("<a href='/team/" + myTeamId, i1);
          console.log("checkFightResult: index=" + index + " i2=" + i2);
          if (index == -1) {
            console.log("Echec de l'analyse du rapport de combat");
            return;
          }
          if (index < i2) {
            console.log("Victoire !");
            fight.result = ResultEnum.VICTORY;
            if (el) el.style.backgroundColor = ColorEnum.VICTORY;
          } else {
            console.log("Défaite !");
            fight.result = ResultEnum.DEFEAT;
            if (el) el.style.backgroundColor = ColorEnum.DEFEAT;
          }
        }
  });
}

function checkFights()
{
  for (var i=0; i<fights.length; i++) {
    if (fights[i].result == ResultEnum.UNDEFINED)
      checkFightResult(fights[i]);
  }
}

var FightTypeEnum = { UNDEFINED:0, SOLO:1, FARMER:2, TEAM:3 };
var ResultEnum = { UNDEFINED:0, EQUALITY:1, VICTORY:2, DEFEAT:3 };
var ColorEnum = { UNDEFINED:"rgb(242, 242, 242)", EQUALITY:"rgb(220, 220, 220)", VICTORY:"rgb(184, 255, 179)", DEFEAT:"rgb(255, 179, 174)" };
var fights = [];
var myFirstLeekId = 0;
var myTeamId = 0;
//wait page loaded
window.addEventListener('load', function () {
  myFirstLeekId = $("div.leek.myleek").attr("id");
  console.log("myFirstLeekId=" + myFirstLeekId);
  var menu = document.getElementById('menu');
  var links = menu.getElementsByTagName('a');
  for(var i=0; i<links.length; i++) {
    var href = links[i].getAttribute('href');
    if (href.startsWith('/team/')) {
      myTeamId = href.substr(6);
      console.log("myTeamId=" + myTeamId);
      break;
    }
  }
  setInterval(function(){checkFights()}, 3000);
}, false);