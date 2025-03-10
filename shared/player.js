export default function Player(id, x, y, player) {
    this.id = id
    this.x = x
    this.y = y
    this.p1 = player
    this.dx = 0
    this.dy = 0
    this.mouseX = 0
    this.mouseY = 0
    this.ball = null

    //height and width constants going to find a better way to store these
    this.width = 50
    this.height = 100

    this.center = [
        this.x + this.width / 2,
        this.y + this.height / 2
    ]
}
