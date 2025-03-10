export default function Collisions(mapWidth, mapHeight) {
    this.mapWidth = mapWidth
    this.mapHeight = mapHeight
    this.gameObjects = []


    this.addGameObject = function(obj) {
        this.gameObjects.push(obj)
    }

    this.outOfBounds = function(object)  {
        let objectWidth = 0
        let objectHeight = 0

        // if there object is not a cirle we account for width and height
        if (!object.radius) {
            objectWidth = object.width
            objectHeight = object.height
        }

        if (
            object.x <= 0 ||
            object.x + objectWidth >= this.mapWidth ||
            object.y <= 0 ||
            object.y + objectHeight >= this.mapHeight
        ) {
            return true
        } else {
            return false
        }
    }

    this.playerCollision = function(player) {

        // player is used to differentiate objects, it can refer to bullet in this case
        let playerWidth = 0
        let playerHeight = 0

        // if there object is not a cirle we account for width and height
        if (!player.radius) {
            playerWidth = player.width
            playerHeight = player.height
        }

        for (let i = 0; i < this.gameObjects.length; i++) {
            let gameObject = this.gameObjects[i]

            if (
                player.x + playerWidth > gameObject.x &&
                player.x < gameObject.x + gameObject.width &&
                player.y + playerHeight > gameObject.y &&
                player.y < gameObject.y + gameObject.height
            ) {
                return "bruh"
            }
        }
        return null
    }

    this.bulletCollidesWithPlayer = function(bullet, player) {
        const distX = bullet.x - Math.max(player.x, Math.min(bullet.x, player.x + player.width));
        const distY = bullet.y - Math.max(player.y, Math.min(bullet.y, player.y + player.height));

        const distance = Math.sqrt(distX * distX + distY * distY);

        if (distance < bullet.radius) {
            return true
        }
        return false
    }

    this.stopPlayer = function(player) {
        player.state = 'stopped'  
        if (player.x < 2) {
            player.state = 'west';
        } else if (player.x + player.width > this.mapWidth - 2) {
            player.state = 'east';
        } else if (player.y < 2) {
            player.state = 'north';
        } else if (player.y + player.height > this.mapHeight - 2) {
            player.state = 'south';
        }
    }  

    this.bulletCollidesHorizontal = function(bullet, obj) {
        const overLapTop = Math.abs(bullet.y - obj.y)
        const overLapBottom = Math.abs(bullet.y - (obj.y + obj.height))
        const overLapRight = Math.abs(bullet.x - (obj.x + obj.width))
        const overLapLeft = Math.abs(bullet.x - obj.x)
        const smallestOverlap = Math.min(overLapTop, overLapBottom, overLapRight, overLapLeft)

        if (bullet.x < 0 || bullet.x > this.mapWidth) {
            return false
        } else if (bullet.y > this.mapHeight || bullet.y < 0){
            return true
        }

        if (smallestOverlap === overLapBottom || smallestOverlap === overLapTop) {
            return true 
        } else {
            return false
        }
    };
}
