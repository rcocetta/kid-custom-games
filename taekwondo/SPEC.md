I want you to create a plan that then can be executed with subagents. 
Use subagents that are adapt to the task, and spend less tokens, do not do everything with Opus. 
I want at least a pause in the plan to review iterate on assets as soon as they're ready. 


# General 
The Taekwondo Master game is a simple fight game for 1 player playing against CPU. It's obviously based on taekwondo, we want it to be playable on mobile, but it's better played on desktop. 

It has to be part of the same group of custom kid games and can be played offline from the app. 

If we find out that the size is too big, we'll figure out the downloading strategy. 

## Style
The style should be the same as Oli's scooter dash. Maybe with longer arms and legs to make the game more visual for taekwondo. 

## Sport inspiration.
Do some research to see what the precise taekwondo moves look like.

## Characters
The characters are always sideways, facing either left or right, but always facing their opponent (except if they're doing a spinning kick).

When standing you can clearly see both legs, and both arms. The arms have a guard position, one in front, and one sligtly back. Elbows initially bent.

Their total energy is 100

## Available Moves
* Move:
    * back or forward (right or left depending where they're facing)
    * jump and duck
* Punches:
    * Back hand (6 damage)
    * Front hand (4 damage)
* Kicks: 
    * Front Kick (8 damage)
    * Back kick (10 damage)#

Punches and kicks have their own version when jumping and ducking (jumping kick, jumping punch, low kick, low punch)

### Defense
If you go back while being hit, it protects itself (possibly with a precise taekwondo parade) it halves the damage.

### Special moves 
We keep it simple for now. 
The only special moves happen when you go back and kick or punch. 

It turns them to back spinning kick or punches 
- to head height if you use the front limb (fron)
- to body height if you use the back limb. 

If you're jumping or ducking, spinning versions of the same kicks.


## Main Character (the one you play with)
For the time being you can only pick 2 characters at the beginning of the game:
* Oli: 
    * Same character as Oli's scooter dash but dressed for taekwondo
    * His uniform is white, and he has a blue belt. 
* Dani: 
    * Brown hair with a ponytail
    * White skin
    * Brown eyes
    * Pink gi

The main character starts from the left, facing the right. 

## Additional poses
We need 
* a winning pose
* a defeated and KO pose


## Opponents
the opponents have the same design but their skin colour, gender and hairstyle is randomized across {white, black, asian looking}, {male, female}, {short, long, ponytail}

Their belts depends on their level. 

The gi is green

# Gameplay
It's 1 player only vs 1 CPU player. 

## Tournament mode
You play against CPU. Best of 3 rounds. 

The CPU goes through increasing levels of belt

* White
* Yellow
* Orange
* Green
* Purple
* Blue
* Red
* Black

If you beat a belt, you progress to the next. If you beat black belt you won th etournament. 

### Note on CPU Player
I actually don't know how to build an increasing level of difficulty, I imagine it increases in speed, ability to defend, and precision in attacks, I'm open to suggestions. 


## Practice mode

You can play "Practice mode" against a white belt, without energy levels or damage. 

## Controls


### desktop
the only tricky part is that we want to support both QWERTY and AZERTY

* movement is based on up, down, left, right arrows. 
* A/Q=back punch
* S=front punch
* Z/W=back kick
* X=front kick
* P=PAUSE
* Esc moves you back with confirmation

### mobile
On the bottom left, a round joypad like, control (a little transparent, on screen). 
On the right, controls for kicks and punches. Punches on the line above, kicks on the one below.

