const { parseDocBlocks } = require("./lib/parsing")

test("simple class", () => {
  const result = parseDocBlocks(
    `
    /**
     * Description
     * @property name description
     */
     class Simple {
        /**
        * Logs the user in
        *
        * @param username Username
        * @param password Password
        */
        fun login(username: String, password: String) {}

        /**
        * Does scret stuff
        */
        private fun secretStuff() {}

        /**
         * Decorator
         */
         @decorator
         fun decorated() {}
      }
    }`,
  )

  expect(result.length).toEqual(4)
  expect(result[0].type).toEqual(["class"])
  expect(result[0].name).toEqual("Simple")
  expect(result[0].tags[0].tag).toEqual("property")
  expect(result[0].tags[0].name).toEqual("name")
  expect(result[0].tags[0].description).toEqual("description")

  expect(result[1].type).toEqual(["fun"])
  expect(result[1].name).toEqual("login")
  expect(result[1].tags[0].tag).toEqual("param")
  expect(result[1].tags[0].name).toEqual("username")
  expect(result[1].tags[0].description).toEqual("Username")
  expect(result[1].tags[1].tag).toEqual("param")
  expect(result[1].tags[1].name).toEqual("password")
  expect(result[1].tags[1].description).toEqual("Password")

  expect(result[2].type).toEqual(["private", "fun"])
  expect(result[2].name).toEqual("secretStuff")

  expect(result[3].type).toEqual(["fun"])
  expect(result[3].name).toEqual("decorated")
})

test("constructor", () => {
  const result = parseDocBlocks(`
    /**
     * Person
     */
    class Person constructor(firstName: String) {  }
  `)
  expect(result.length).toEqual(1)
  expect(result[0].name).toEqual("Person")
  expect(result[0].type).toEqual(["class"])
})

test("init block", () => {
  const result = parseDocBlocks(`
    /**
     * Person
     */
    class Person(firstName: String) {  }
  `)
  expect(result.length).toEqual(1)
  expect(result[0].name).toEqual("Person")
  expect(result[0].type).toEqual(["class"])
})

test("abstract class", () => {
  const result = parseDocBlocks(
    `
    /**
     * Description
     */
     abstract class Abstract {
    }`,
  )
  expect(result[0].type).toEqual(["abstract", "class"])
  expect(result[0].name).toEqual("Abstract")
  expect(result[0].tags).toEqual([])
})

test("subclass", () => {
  const result = parseDocBlocks(
    `
    /**
     * Description
     */
     class Child : Parent {
    }`,
  )
  expect(result[0].type).toEqual(["class"])
  expect(result[0].name).toEqual("Child")
  expect(result[0].tags).toEqual([])
})

test("generic subclass", () => {
  const result = parseDocBlocks(
    `
    /**
     * Description
     */
    class Child : Parent<Result>() {
    }`,
  )
  expect(result[0].type).toEqual(["class"])
  expect(result[0].name).toEqual("Child")
  expect(result[0].tags).toEqual([])
})
