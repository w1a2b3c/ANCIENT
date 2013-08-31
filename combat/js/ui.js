/*	Class UI
*
*	Object containing UI DOM element, update functions and event managment on UI.
*
*/
var UI = Class.create({

	/*	Attributes
	*	
	*	NOTE : attributes and variables starting with $ are jquery element 
	*	and jquery function can be called dirrectly from them.
	*
	*	$display :		UI container 
	*	$queue :		Queue container
	*	$textbox :		Chat and log container
	*	$activebox :	Current active creature panel (left panel) container
	*	$dash :			Overview container
	*	$grid :			Creature grid container
	*
	*	selectedCreature : 	String : 	ID of the visible creature card
	*	selectedPlayer : 	Integer : 	ID of the selected player in the dash
	*
	*/


	/*	Constructor
	*	
	* 	Create attributes and default buttons
	*
	*/
	initialize: function(){
		this.$display = $j("#ui");
		this.$queue = $j("#queuewrapper");
		this.$dash = $j("#dash");
		this.$grid = $j("#creaturegrid");
		this.$activebox = $j("#activebox");

		//Chat
		this.chat = new Chat();

		//Buttons Objects
		this.buttons = [];
		this.abilitiesButtons = [];

		//Dash Button
		this.btnToggleDash = new Button({
			$button : $j(".toggledash"),
			click : function(e){G.UI.toggleDash();},
		});
		this.buttons.push(this.btnToggleDash);

		//Skip Turn Button
		this.btnSkipTurn = new Button({
			$button : $j("#skip.button"),
			click : function(e){ if(!G.UI.dashopen){
				G.gamelog.add({action:"skip"});
				G.skipTurn();
			}},
		});
		this.buttons.push(this.btnSkipTurn);

		//Delay Creature Button
		this.btnDelay = new Button({
			$button : $j("#delay.button"),
			click : function(e){ if(!G.UI.dashopen){ 
				G.gamelog.add({action:"delay"});
				G.delayCreature();
			}},
		});
		this.buttons.push(this.btnDelay);

		//Flee Match Button
		this.btnFlee = new Button({
			$button : $j("#flee.button"),
			click : function(e){ if(!G.UI.dashopen){
				if( G.turn < G.minimumTurnBeforeFleeing ){
					alert("You cannot flee the match in the first 10 rounds.");
					return;
				}
				if( G.activeCreature.player.isLeader() ){
					alert("You cannot flee the match while being in lead.");
					return;
				}

				if(window.confirm("Are you sure you want to flee the match?")){
					G.gamelog.add({action:"flee"});
					G.activeCreature.player.flee();
				}
			}},
			state : "disabled",
		});
		this.buttons.push(this.btnFlee);

		//Binding Hotkeys
		$j(document).on('keypress', function(e){

			var keypressed = e.keyCode;
			// console.log(keypressed);

			hotkeys = {
				attack: 119, //W
				ability: 101, //E
				ultimate: 114, //R
				overview: 97, //A
				skip: 115, //S
				delay: 100, //D
				flee: 102, //F
				chat: 99, //C
			};

			var prevD = false;

			$j.each(hotkeys,function(k,v){
				if(v==keypressed){
					switch(k){
						case "attack": G.UI.abilitiesButtons[1].triggerClick(); break;
						case "ability": G.UI.abilitiesButtons[2].triggerClick(); break;
						case "ultimate": G.UI.abilitiesButtons[3].triggerClick(); break;
						case "overview": G.UI.btnToggleDash.triggerClick(); break;
						case "skip": G.UI.btnSkipTurn.triggerClick(); break;
						case "delay": G.UI.btnDelay.triggerClick(); break;
						case "flee": G.UI.btnFlee.triggerClick(); break;
						case "chat": G.UI.chat.toggle(); break;
					}
					prevD = true;
				}
			});
			if(prevD){
				e.preventDefault();
				return false;
			}
		});

		for (var i = 0; i < 4; i++) {
			var b = new Button({
				$button : $j("#abilities > div:nth-child("+(i+1)+") > .ability"),
				abilityId : i,
			});
			this.buttons.push(b);
			this.abilitiesButtons.push(b);
		};

		this.$dash.children("#playertabswrapper").addClass("numplayer"+G.nbrPlayer);

		this.selectedCreature = "";
		this.selectedPlayer = 0;
		this.selectedAbility = -1;
		
		this.materializeToggled = false;
		this.dashopen = false;

		if(G.turnTimePool) $j(".turntime").text(zfill(Math.floor(G.turnTimePool/60),2)+":"+zfill(G.turnTimePool%60,2));
		if(G.timePool) $j(".timepool").text(zfill(Math.floor(G.timePool/60),2)+":"+zfill(G.timePool%60,2));			

		//Show UI
		this.$display.show();
	},

	
	resizeDash: function(){
		var zoom = $j("#cardwrapper").outerWidth()/$j("#card").outerWidth();
		zoom = (zoom<1) ? zoom : 1;
		$j("#cardwrapper_inner").css("zoom",zoom);

		zoom = $j("#creaturegridwrapper").innerWidth()/$j("#creaturegrid").innerWidth();
		zoom = (zoom<1) ? zoom : 1;
		$j("#creaturegrid").css("zoom",zoom);
	},


	/*	showCreature(creatureType,player)
	*	
	*	creatureType : 	String : 	Creature type
	*	player : 		Integer : 	Player ID
	*
	* 	Query a creature in the available creatures of the active player
	*
	*/
	showCreature: function(creatureType,player){

		this.dashopen = true;

		//Set dash active
		this.$dash.addClass("active");
		this.$dash.children("#tooltip").removeClass("active");
		this.$dash.children("#playertabswrapper").addClass("active");
		this.changePlayerTab(G.activeCreature.team);

		this.$dash.children("#playertabswrapper").children(".playertabs").unbind('click').bind('click',function(e){
			if(G.freezedInput) return;
			G.UI.showCreature("--",$j(this).attr("player")-0);
		});

		//Change player infos
		for (var i = G.players.length - 1; i >= 0; i--) {
			$j("#dash .playertabs.p"+i+" .vignette").css("background-image","url('"+G.players[i].avatar+"')");
			$j("#dash .playertabs.p"+i+" .name").text(G.players[i].name);
			$j("#dash .playertabs.p"+i+" .plasma").text("Plasma "+G.players[i].plasma);
			$j("#dash .playertabs.p"+i+" .score").text("Score "+G.players[i].getScore().total);
		};

		//Change to the player tab
		if(player != G.UI.selectedPlayer){this.changePlayerTab(player);}

		this.$grid.children(".vignette").removeClass("active")
		.filter("[creature='"+creatureType+"']").addClass("active");

		this.selectedCreature = creatureType;

		var stats = G.retreiveCreatureStats(creatureType);

		//TODO card animation
		if( $j.inArray(creatureType, G.players[player].availableCreatures)>0 || creatureType=="--"){
			//If creature is available

			//Retreive the summoned creature if it exists
			var crea = undefined;
			G.players[player].creatures.each(function(){
				if(this.type == creatureType)
					crea = this;
			});

			//Recto
			$j("#card .card.recto").css({"background-image":"url('../bestiary/"+stats.name+"/artwork.jpg')"});
			$j("#card .card.recto .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin"+stats.type.substring(0,1));
			$j("#card .card.recto .type").text(stats.type);
			$j("#card .card.recto .name").text(stats.name);
			$j("#card .card.recto .hexs").text(stats.size+"H");

			//Verso
			$j.each(stats.stats,function(key,value){
				var $stat = $j("#card .card.verso ."+key+" .value");
				$stat.removeClass("buff debuff");
				if(crea){
					if(key=="health"){
						$stat.text(crea.health+"/"+value);
					}else if(key=="endurance"){
						$stat.text(crea.endurance+"/"+value);
					}else{
						$stat.text(crea.stats[key]);
						if(crea.stats[key]>value){ //Buff
							$stat.addClass("buff");
						}else if(crea.stats[key]<value){ //Debuff
							$stat.addClass("debuff");
						}
					}
				}else{
					$stat.text(value);
				}
			});
			$j.each(abilities[stats.id],function(key,value){
				$ability = $j("#card .card.verso .abilities .ability:eq("+key+")");
				$ability.children('.icon').css({"background-image":"url('../bestiary/"+stats.name+"/"+key+".svg')"});
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").text(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").text(stats.ability_info[key].info);
			});

			var summonedOrDead = false;
			G.players[player].creatures.each(function(){
				if(this.type == creatureType){
					summonedOrDead = true;
				}
			});

			//Materialize button
			$j('#materialize_button').unbind('click');
		
			if(G.activeCreature.player.getNbrOfCreatures() > G.creaLimitNbr){
				$j('#materialize_button p').text(G.msg.ui.dash.materialize_overload);
			}else if(
				!summonedOrDead && 
				G.activeCreature.player.id==player && 
				G.activeCreature.type=="--" &&
				G.activeCreature.abilities[3].used==false
			  )
			{	
				var lvl = creatureType.substring(1,2)-0;
				var size = G.retreiveCreatureStats(creatureType).size-0;
				plasmaCost = lvl+size;

				//Messages
				if(plasmaCost>G.activeCreature.player.plasma){
					$j('#materialize_button p').text("Low Plasma! Cannot materialize the selected unit");
				}else{
					$j('#materialize_button p').text("Materialize unit at target location for "+plasmaCost+" plasma");

					//Bind button
					$j('#materialize_button').bind('click',function(e){
						if(G.freezedInput) return;
						G.UI.materializeToggled = true;
						G.UI.selectAbility(3);
						G.UI.closeDash(true);
						G.activeCreature.abilities[3].materialize(G.UI.selectedCreature);
					});
				}

			}else{
				if (
					G.activeCreature.player.id==player && 
					G.activeCreature.type=="--" &&
					G.activeCreature.abilities[3].used==true
				){
					$j('#materialize_button p').text("Materialization has already been used this round");
				}else if(
					G.activeCreature.player.id==player && 
					G.activeCreature.type=="--"
				){
					$j('#materialize_button p').text("Please select an available unit from the left grid");
				}else if (G.activeCreature.type!="--"){
					$j('#materialize_button p').text("The current active unit cannot materialize others");
				}
			}

		}else{
			//TODO Locked card
			//$j("#card").text("Locked");
		}
	},


	selectAbility: function(i){
		if( this.selectedAbility > -1 )
			this.abilitiesButtons[this.selectedAbility].changeState("normal");
		this.selectedAbility = i;
		if( i>-1 )
			this.abilitiesButtons[i].changeState("active");
	},


	/*	changePlayerTab(id)
	*
	*	id : 	Integer : 	player id
	*
	*	Change to the specified player tab in the dash
	*
	*/
	changePlayerTab: function(id){
		this.selectedPlayer = id;
		this.$dash //Dash class
		.removeClass("selected0 selected1 selected2 selected3")
		.addClass("selected"+id);

		this.$grid.children(".vignette") //vignettes class
		.removeClass("active dead queued")
		.addClass("locked");

		//change creature status
		G.players[id].availableCreatures.each(function(){
			G.UI.$grid.children(".vignette[creature='"+this+"']").removeClass("locked");
		});
		G.players[id].creatures.each(function(){
			if(this.dead == true){
				G.UI.$grid.children(".vignette[creature='"+this.type+"']").addClass("dead");
			}else{
				G.UI.$grid.children(".vignette[creature='"+this.type+"']").addClass("queued");
			}
		});

		//Bind creature vignette click
		this.$grid.children(".vignette").unbind('click').bind("click",function(e){
			e.preventDefault();
			if(G.freezedInput) return;

			if($j(this).hasClass("locked")){
				G.UI.$dash.children("#tooltip").text("Creature locked.");
			}

			var creatureType = $j(this).attr("creature");
			G.UI.showCreature(creatureType,G.UI.selectedPlayer);
		});

	},


	/*	toggleDash()
	*
	*	Show the dash and hide some buttons
	*
	*/
	toggleDash: function(){
		if(!this.$dash.hasClass("active")){
			this.showCreature(G.activeCreature.type,G.activeCreature.team);
		}else{
			this.closeDash();
		}

	},

	closeDash: function(materialize){
		this.$dash.removeClass("active");
		if(!materialize){
			this.selectAbility(-1);
			G.activeCreature.queryMove();
		}
		this.dashopen = false;
		this.materializeToggled = false;
	},


	/*	updateActiveBox()
	*
	*	Update activebox with new current creature's abilities
	*
	*/
	updateActivebox: function(){
		var $abilitiesButtons = $j("#abilities .ability");
		$abilitiesButtons.unbind("click");

		this.$activebox.children("#abilities").clearQueue().transition({y:"-420px"},function(){//Hide panel	
			$j(this).removeClass("p0 p1 p2 p3").addClass("p"+G.activeCreature.player.id);
			//Change abilities buttons
			G.UI.abilitiesButtons.each(function(){
				var ab = G.activeCreature.abilities[this.abilityId];
				this.css.normal = {"background-image":"url('../bestiary/"+G.activeCreature.name+"/"+this.abilityId+".svg')"};
				this.$button.next(".desc").children("span").text(ab.title);
				this.$button.next(".desc").children("p").html(ab.desc+"<br>"+ab.info);

				this.click = function(){
					if(G.UI.dashopen) return false;
					
					G.grid.clearHexViewAlterations();
					if(G.UI.selectedAbility!=this.abilityId){
						//Activate Abilitie
						G.activeCreature.abilities[this.abilityId].use();
					}else{
						//Cancel Abilitie
						G.UI.closeDash();
						G.activeCreature.queryMove();
					}
				};
				this.changeState(); //ApplyChanges
			});
			G.UI.$activebox.children("#abilities").transition({y:"0px"}); //Show panel
		});

		if(G.activeCreature.player.creatures.length==1) //Blinking summon button during the 1st round
			this.abilitiesButtons[3].changeState("glowing");

		this.updateInfos();
	},

	checkAbilities : function(){
		for (var i = 0; i < 4; i++) {
			var ab = G.activeCreature.abilities[i];
			ab.message = "";
			var req = ab.require();
			ab.message = (ab.used) ? G.msg.abilities.alreadyused : ab.message;
			if( req && !ab.used && ab.trigger=="onQuery"){
				this.abilitiesButtons[i].changeState("glowing");
			}else if( ab.message==G.msg.abilities.notarget || ( ab.trigger!="onQuery" && req && !ab.used ) ){
				this.abilitiesButtons[i].changeState("normal");
			}else{
				this.abilitiesButtons[i].changeState("disabled");
			}
		};
	},

	/*	updateInfos()
	*	
	*/
	updateInfos:function(){
		$j("#playerbutton, #playerinfos")
			.removeClass("p0 p1 p2 p3")
			.addClass("p"+G.activeCreature.player.id);
		$j("#playerbutton").css("background-image","url('"+G.activeCreature.player.avatar+"')");
		$j("#playerinfos .name").text(G.activeCreature.player.name);
		$j("#playerinfos .points span").text(G.activeCreature.player.getScore().total);
		$j("#playerinfos .plasma span").text(G.activeCreature.player.plasma);
	},


	/*	updateTimer()
	*	
	*/
	updateTimer:function(){
		var date = new Date();

		//TurnTimePool
		if( G.turnTimePool >= 0 ){
			var remainingTime = G.turnTimePool - Math.round((date - G.activeCreature.player.startTime)/1000);
			if(G.timePool > 0)
				remainingTime = Math.min(remainingTime, Math.round( (G.activeCreature.player.totalTimePool-(date - G.activeCreature.player.startTime))/1000) );
			var minutes = Math.floor(remainingTime/60);
			var seconds = remainingTime-minutes*60;
			var id = G.activeCreature.player.id;
			$j(".p"+id+" .turntime").text(zfill(minutes,2)+":"+zfill(seconds,2));
			//Time Alert
			if( remainingTime < G.turnTimePool*.25 ) 
				$j(".p"+id+" .turntime").addClass("alert");
			else
				$j(".p"+id+" .turntime").removeClass("alert");
		}else{
			$j(".turntime").text("∞");
		}

		//TotalTimePool
		if( G.timePool >= 0 ){
			G.players.each(function(){
				var remainingTime = (this.id == G.activeCreature.player.id) ? this.totalTimePool - (date - this.startTime) : this.totalTimePool;
				remainingTime = Math.max(Math.round(remainingTime/1000),0);
				var minutes = Math.floor(remainingTime/60);
				var seconds = remainingTime-minutes*60;
				$j(".p"+this.id+" .timepool").text(zfill(minutes,2)+":"+zfill(seconds,2));
			});
		}else{
			$j(".timepool").text("∞");
		}
	},


	/*	updateQueueDisplay()
	*	
	* 	Delete and add element to the Queue container based on the game's queues
	*
	*/
	updateQueueDisplay: function(){ //Ugly as hell need rewrite

		if(!G.nextQueue.length || !G.activeCreature ) return false; //Abort to avoid infinite loop

		var queueAnimSpeed = 500;

		var $vignettes = this.$queue.children('.queue[turn]').children('.vignette');
		var $queues = this.$queue.children('.queue[turn]');

		if( ($queues.first().attr("turn")-0) < G.turn){ //If first queue turn is lower than game turn 
			$vignettes.each(function(){
				$j(this).attr("queue",$j(this).attr("queue")-1); //decrement vignettes
			});
			$queues.each(function(){
				$j(this).attr("queue",$j(this).attr("queue")-1); //decrement queues
				if($j(this).attr("queue")-0<0){ 
					$j(this).children(".vignette").transition({width:0},queueAnimSpeed,function(){ this.remove(); });
					$j(this).transition({opacity:1},queueAnimSpeed,function(){ this.remove(); }); //Let vignette fade and remove ancients queues
					$j(this).removeAttr("turn");
				 };
			});
		}

		//Prepend Current creature to queue after copying it
		var completeQueue = G.queue.slice(0);
		completeQueue.unshift(G.activeCreature);
		completeQueue = completeQueue.concat(G.delayQueue);
		completeQueue = completeQueue.concat(["nextround"]);

		var u = 0;		
		while(	u < 2 || //Only display 2 queues 
			//$vignettes.size() < 12 || //While queue does not contain enough vignette OR
			u < $queues.size() ){ //not all queue has been verified
			var queue = (u==0)? completeQueue : G.nextQueue ;

			//Updating
			var $vignettes = this.$queue.children('.queue[turn]').children('.vignette');
			var $queues = this.$queue.children('.queue[turn]');

			if($queues[u] == undefined){ //If queue doenst exists
				if(u==0){
					this.$queue.append('<div queue="'+u+'" class="queue" turn="'+(u+G.turn)+'"></div>');
				}else{
					$j($queues[u-1]).after('<div queue="'+u+'" class="queue" turn="'+(u+G.turn)+'"></div>');
				}
				var $queues = this.$queue.children('.queue[turn]');
			}

			var $Q = $vignettes.filter('[queue="'+u+'"]');

			//For all element of this queue
			for (var i = 0; i < queue.length; i++) {

				//Round Marker
				if( typeof queue[i] == "string" ){

					//If this element doesnot exists
					if($Q[i] == undefined){
						$j($Q[i-1]).after('<div queue="'+u+'" roundmarker="1" class="vignette roundmarker"><div></div></div>');

						//Updating
						var $Q = this.$queue.children('.queue').children('.vignette').filter('[queue="'+u+'"]');
						var $queues = this.$queue.children('.queue[turn]');

						$Q.filter('[roundmarker="1"][queue="'+u+'"]').css({width:0}).transition({width:80},queueAnimSpeed,function(){ $j(this).removeAttr("style"); });
					}
				}else{
					var initiative =  queue[i].getInitiative( (u==0) );

					//If this element doesnot exists
					if($Q[i] == undefined){
						if(i==0){
							$j($queues[u]).append('<div queue="'+u+'" creatureid="'+queue[i].id+'" initiative="'+initiative+'" class="vignette hidden p'+queue[i].team+" type"+queue[i].type+'"><div></div></div>');
						}else{
							$j($Q[i-1]).after('<div queue="'+u+'" creatureid="'+queue[i].id+'" initiative="'+initiative+'" class="vignette hidden p'+queue[i].team+" type"+queue[i].type+'"><div></div></div>');
						}
						//Updating
						var $Q = this.$queue.children('.queue').children('.vignette').filter('[queue="'+u+'"]');
						var $queues = this.$queue.children('.queue[turn]');

						$Q.filter('[creatureid="'+queue[i].id+'"][queue="'+u+'"]').css({width:0}).transition({width:80},queueAnimSpeed,function(){ $j(this).removeAttr("style"); });
					}else if(queue[i] == undefined){
						$j($Q[i]).attr("queue","-1").transition({width:0},queueAnimSpeed,function(){ this.remove(); });
						//Updating
						var $Q = this.$queue.children('.queue').children('.vignette').filter('[queue="'+u+'"]');
						var $queues = this.$queue.children('.queue[turn]');
					}else{
						while( $j($Q[i]).attr("creatureid") != queue[i].id ){
							if( $j($Q[i]).attr("initiative") < initiative ) {
								$j($Q[i]).before('<div queue="'+u+'" creatureid="'+queue[i].id+'" initiative="'+initiative+'" class="vignette hidden p'+queue[i].team+" type"+queue[i].type+'"><div></div></div>');
								this.$queue.children('.queue').children('.vignette').filter('[creatureid="'+queue[i].id+'"][queue="'+u+'"]').css({width:0}).transition({width:80},queueAnimSpeed,function(){ $j(this).removeAttr("style"); });
							}else{
								$j($Q[i]).attr("queue","-1").transition({width:0},queueAnimSpeed,function(){ this.remove(); });
							}

							//Updating
							var $Q = this.$queue.children('.queue').children('.vignette').filter('[queue="'+u+'"]');
							var $queues = this.$queue.children('.queue[turn]');
						}
					}
				}
			};

			if( queue.length < $Q.length ){ //If displayed queue is longer compared to real queue
				for(var i = 0; i < $Q.length - queue.length; i++){
					//Chop the excess
					$Q.last().attr("queue","-1").transition({width:0},queueAnimSpeed,function(){ this.remove(); });
					var $Q = this.$queue.children('.queue').children('.vignette').filter('[queue="'+u+'"]');
				}
			}

			//Set active creature
			this.$queue.children('.queue').children('.vignette').filter(".active").removeClass("active"); //Avoid bugs
			this.$queue.children('.queue[queue="0"]').children('.vignette[queue="0"]').first().addClass("active");

			//Add mouseover effect
			this.$queue.children('.queue').children('.vignette').not(".roundmarker").unbind("mouseover").unbind("mouseleave").bind("mouseover",function(){
				if(G.freezedInput) return;
				var creaID = $j(this).attr("creatureid")-0;
				G.creatures.each(function(){
					if(this instanceof Creature){
						this.$display.removeClass("ghosted");
						this.$health.removeClass("ghosted");
						if(this.id != creaID){ this.$display.addClass("ghosted"); this.$health.addClass("ghosted"); };
					}
				});
				G.UI.xrayQueue(creaID);
			}).bind("mouseleave",function(){ //On mouseleave cancel effect
				if(G.freezedInput) return;
				G.creatures.each(function(){
					if(this instanceof Creature){
						this.$display.removeClass("ghosted");
					}
				});
				G.UI.xrayQueue(-1);
			}).bind("click",function(){ //Show dash on click
				if(G.freezedInput) return;
				var creaID = $j(this).attr("creatureid")-0;
				G.UI.showCreature(G.creatures[creaID].type,G.creatures[creaID].team);
			});

			u++;
		}
	},

	xrayQueue : function(creaID){
		this.$queue.children('.queue').children('.vignette').removeClass("xray");
		if(creaID>0) this.$queue.children('.queue').children('.vignette').not('[creatureid="'+creaID+'"]').addClass("xray");
	}

});

var Chat = Class.create({
	/*	Constructor
	*	
	* 	Chat/Log Functions
	*
	*/
	initialize: function(){
		this.$chat = $j("#chat");
		this.$content = $j("#chatcontent");
		this.$chat.bind('click',function(){G.UI.chat.toggle();});
	},


	show : function(){ this.$chat.addClass("focus"); },
	hide : function(){ this.$chat.removeClass("focus"); },
	toggle : function(){ this.$chat.toggleClass("focus"); },

	addMsg : function(msg){
		var time = new Date(new Date() - G.startMatchTime);
		this.$content.append("<p>"+zfill(time.getHours()-1,2)+":"+zfill(time.getMinutes(),2)+":"+zfill(time.getSeconds(),2)+" "+msg+"</p>");
		this.$content.parent().scrollTop(this.$content.height());
	},
});


var Button = Class.create({
	/*	Constructor
	*	
	* 	Create attributes and default buttons
	*
	*/
	initialize: function(opts){

		defaultOpts = {
			click : function(){},
			mouseover : function(){},
			mouseleave : function(){},
			clickable : true,
			state : "normal", // disabled,normal,glowing,selected,active
			$button : undefined,
			attributes : {},
			css : {
				disabled  	: {},
				glowing  	: {},
				selected  	: {},
				active 		: {},
				normal 		: {},
			}
		};

		opts = $j.extend(defaultOpts,opts);
		$j.extend(this,opts);
		this.changeState(this.state);
	},


	changeState : function(state){
		var btn = this;

		if(!state) state = this.state;
		this.state = state;
		this.$button.unbind("click").unbind("mouseover").unbind("mouseleave");
		if( state != "disabled" ){
			this.$button.bind("click",function(){
				if(G.freezedInput || !btn.clickable) return;
				btn.click();
			} );
			this.$button.bind("mouseover",function(){
				if(G.freezedInput || !btn.clickable) return;
				btn.mouseover();
			} );
			this.$button.bind("mouseleave",function(){
				if(G.freezedInput || !btn.clickable) return;
				btn.mouseleave();
			} );
		}
		this.$button.removeClass("disabled glowing selected active")
		this.$button.css( this.css["normal"] );
		if( state != "normal" ){
			this.$button.addClass(state);
			this.$button.css( this.css[state] );
		}
	},

	triggerClick : function(){
		if(G.freezedInput || !this.clickable) return;
		this.click();
	},

	triggerMouseover : function(){
		if(G.freezedInput || !this.clickable) return;
		this.mouseover();
	},

	triggerMouseleave : function(){
		if(G.freezedInput || !this.clickable) return;
		this.mouseleave();
	},
});
