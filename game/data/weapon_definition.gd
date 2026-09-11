class_name WeaponDefinition
extends Resource

@export var id: String = "weapon"
@export var display_name: String = "Weapon"
@export var short_name: String = "WPN"
@export var cost: int = 0
@export var damage: float = 20.0
@export var headshot_multiplier: float = 1.7
@export var fire_interval: float = 0.2
@export var magazine_size: int = 12
@export var reserve_ammo: int = 72
@export var reload_time: float = 1.6
@export var range: float = 90.0
@export var falloff_start: float = 30.0
@export var falloff_min: float = 0.55
@export var spread: float = 0.008
@export var recoil: float = 0.025
@export var automatic: bool = false
@export var pellets: int = 1
## Escala del fogonazo. El resto de la presentación del arma (modelo, montaje,
## agarre, boca) vive en OperatorVisual.WEAPON_CONFIG: aquí solo quedan los
## números que deciden GAMEPLAY y este único valor de FX que sí se consume.
@export var muzzle_flash_scale: float = 1.0
