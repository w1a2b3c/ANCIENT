import Game from '../game';
import { Effect } from '../effect';
import { Hex } from './hex';
import { Player } from '../player';
import { Creature } from '../creature';

import { capitalize } from './string';

export type TrapType =
	| 'firewall'
	| 'mud-bath'
	| 'royal-seal'
	| 'poisonous-vine'
	| 'scorched-ground';

export type DestroyAnimationType = 'shrinkDown' | 'none';

export type TrapOptions = Partial<Trap>;

export class Trap {
	id: number;
	game: Game;
	// TODO: Remove. This can be removed once Traps can be looked up by position.
	hex: Hex;
	type: TrapType;
	name: string;
	effects: Effect[];
	owner: Player;
	creationTurn: number;

	/**
	 * NOTE: The following attributes are typically set in the
	 * constructor using the "config" argument.
	 */
	turnLifetime = 0;
	fullTurnLifetime = false;
	ownerCreature: Creature | undefined = undefined; // Needed for fullTurnLifetime
	destroyOnActivate = false;
	typeOver = false;
	destroyAnimation: DestroyAnimationType = 'none';

	//
	display: Phaser.Sprite;
	displayOver: Phaser.Sprite;

	constructor(
		x: number,
		y: number,
		type: TrapType,
		effects: Effect[],
		owner: Player,
		opt: TrapOptions,
		game: Game,
		name = '',
	) {
		this.game = game;
		this.hex = game.grid.hexes[y][x];
		this.type = type;
		this.name = name || capitalize(type.split('-').join(' '));
		this.effects = effects;
		this.owner = owner;
		this.creationTurn = game.turn;

		for (const key of Object.keys(opt)) {
			if (key in this) {
				this[key] = opt[key];
			}
		}

		this.id = game.trapId++;

		// TODO: Remove
		// This can be removed once Traps can be looked up
		// by position.
		//
		// Register
		game.grid.traps.push(this);
		this.hex.trap = this;

		for (let i = this.effects.length - 1; i >= 0; i--) {
			this.effects[i].trap = this;
		}

		const spriteName = 'trap_' + type;
		const pos = this.hex.originalDisplayPos;

		this.display = game.grid.trapGroup.create(pos.x + this.hex.width / 2, pos.y + 60, spriteName);
		this.display.anchor.setTo(0.5);

		if (this.typeOver) {
			this.displayOver = game.grid.trapOverGroup.create(
				pos.x + this.hex.width / 2,
				pos.y + 60,
				spriteName,
			);
			this.displayOver.anchor.setTo(0.5);
			this.displayOver.scale.x *= -1;
		}
	}

	destroy() {
		const game = this.game;
		const phaser: Phaser.Game = game.Phaser;
		const tweenDuration = 500;

		const destroySprite = (sprite: Phaser.Sprite, animation: string) => {
			if (animation === 'shrinkDown') {
				sprite.anchor.y = 1;
				sprite.y += sprite.height / 2;

				const tween = phaser.add
					.tween(sprite.scale)
					.to({ y: 0 }, tweenDuration, Phaser.Easing.Linear.None)
					.start();
				tween.onComplete.add(() => sprite.destroy());
			} else {
				sprite.destroy();
			}
		};

		destroySprite(this.display, this.destroyAnimation);
		if (this.displayOver) {
			destroySprite(this.displayOver, this.destroyAnimation);
		}

		// TODO: Remove
		// This can be removed once Traps can be looked up
		// by position.
		//
		// Unregister
		const i = game.grid.traps.indexOf(this);
		game.grid.traps.splice(i, 1);
		this.hex.trap = undefined;
	}

	hide(duration = 0) {
		this.game.Phaser.add.tween(this.display).to({ alpha: 0 }, duration, Phaser.Easing.Linear.None);
	}

	show(duration = 0) {
		this.game.Phaser.add.tween(this.display).to({ alpha: 1 }, duration, Phaser.Easing.Linear.None);
	}
}
