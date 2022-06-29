const SERVER = ! (typeof window != 'undefined' && window.document)

if (SERVER) {
    const {readFileSync} = require("fs");
    const {join} = require("path");
}

//REMOVE CODE AFTER COMPILE
import {readFileSync} from "fs"
import {join} from "path"

//? Basic configuration for Feather.js
const config = {
    regex: {
        TagMatch: `<\\s*{TAG}(>|\\s[^>]*>)((\\s|.)*?)<\/{TAG}(>|\\s[^>]*>)`,
        TagMatchFlags: "gmi",
        PropsMatch: /{{([^}}]*)}}/gm
    },
    messages: {
        EvalError: "Error executing javascript from element:",
        TagConfict: "Multiple tags found for:",
    }
}

interface FeatherOptionsType {
    TrustKey: string,
    ssr: boolean,
}

interface PropertyType {
    name: string,
    text: string
}

interface TagType {
    document: FeatherDocument,
    full: string
}

export function UUID() {
    return "UUID_xxxxxxxx_xxxx_4xxx_yxxx_xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == "x" ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

export function EscapeHTML(html:string) {
    if (html == undefined) return ""

    return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;") 
}


/** 
* @returns {string | undefined}
*/
function FeatherImportBundlerCSR (imports: string[], seperator: string = "\n"){
    const bundel = imports.map((path) => {
        var xhttp = new XMLHttpRequest()
        xhttp.open("GET", path, false)
        xhttp.send()
        return xhttp.responseText
    })

    return bundel.join(seperator)
}
/** 
* @returns {string | undefined}
*/
function FeatherImportBundlerSSR (imports: string[], seperator: string = "\n"){
    const bundel = imports.map((path) => {
        return readFileSync(join(__dirname,path), {
            encoding: "utf8"
        })
    })

    return bundel.join(seperator)
}

export class FeatherDocument  {
    raw: string

    TrustKey: string
    origin:FeatherJS

    constructor(raw:string, origin:FeatherJS) {
        this.origin = origin
        this.TrustKey = this.origin.options.TrustKey

        this.raw = raw
    }

    append(quarry:string){
        document.querySelectorAll(quarry).forEach((element) => {
            element.innerHTML = element.innerHTML + this.raw
        })
    }

    prepend(quarry:string){
        document.querySelectorAll(quarry).forEach((element) => {
            element.innerHTML = this.raw + element.innerHTML
        })
    }

    overwrite(quarry:string){
        document.querySelectorAll(quarry).forEach((element) => {
            element.innerHTML = this.raw
        })
    }
    
    UpdateProperties(properties: Object) {
        const MatchedProps = this._GetProperties_()

        if (MatchedProps && properties) {
            for (var property of MatchedProps){
                const value = properties[property.name]
                if (!value) continue

                if (value.TrustKey === this.TrustKey) {
                    this.raw = this.raw.replace(
                        new RegExp(property.text,"g"), 
                        value.raw
                    )

                    console.log(this.raw)
                } else {
                    this.raw = this.raw.replace(
                        new RegExp(property.text,"g"),
                        EscapeHTML(value)
                    )
                }
            }
        }
    }


    _GetProperties_(): PropertyType[] | undefined {
        const props = [
            ...this.raw.matchAll(config.regex.PropsMatch)
        ]
        if (!props) return

        return props.filter((tag) => {
            return tag.length > 1
        }).map((tag) => {
            return {
                text: tag[0],
                name: tag[1]
            }
        })
    }

    _GetTag_(tag:string): TagType | undefined {
        const tags = this._GetTags_(tag)
        if (!tags || tags.length < 1) return
        if(tags.length > 1) console.warn(config.messages.TagConfict, tag)
        
        return tags[0]
    }

    _GetTags_(tag:string): TagType[] | undefined {
        const tags = [
            ...this.raw.matchAll(
                new RegExp(
                    config.regex.TagMatch.replace(new RegExp("{TAG}", "g"), tag), 
                    config.regex.TagMatchFlags
                )
            )
        ]

        if (!tags) return;

        return tags.filter((tag) => {
            return tag.length > 4
        }).map((tag) => {
            return {
                full: tag[0],
                document: new FeatherDocument(tag[2], this.origin)
            }
        })
    }
    
    _EvaluateJavascript_(props:Object = {}, ContainProps = true):any {
        if (ContainProps) {
            const func = Function(...["props", "F"],this.raw)

            try {
                return func(props, this.origin)
            } catch (error) {
                console.error(config.messages.EvalError, error)
            }
        } else {
            const func = Function(...Object.keys(props), "F", this.raw)

            try {
                return func(...Object.values(props), this.origin)
            } catch (error) {
                console.error(config.messages.EvalError, error)
            }
        }
    }
}

export default class FeatherJS {
    BakeElementFromString:(string:string) => FeatherDocument

    ModuleBundel: FeatherDocument
    CssBundel: string

    options: FeatherOptionsType

    constructor(ModuleImportPaths:string[] = [], CssImportPaths:string[] = [], options:FeatherOptionsType = {
        TrustKey: "UUID",
        ssr: false
    }){
        this.options = options
        if (this.options.TrustKey === "UUID") this.options.TrustKey = UUID()

        this.BakeElementFromString = (string) => {
            return new FeatherDocument(string, this)
        }


        const LocalImportBundler = this.options.ssr ? 
            FeatherImportBundlerSSR : 
            FeatherImportBundlerCSR

        this.ModuleBundel = this.BakeElementFromString(
            LocalImportBundler(ModuleImportPaths)
        )

        this.CssBundel = LocalImportBundler(CssImportPaths)
    }
    
    /** 
    * @returns {FeatherDocument | undefined}
    */
    BakeElement(tag:string, InitialProps:Object | Array<Object>): FeatherDocument | undefined {
        //!May be removed in the future
        if (Array.isArray(InitialProps)) {
            const string:string[] = []
            for (var document of InitialProps) {
                const NewDocument = this.BakeElement(tag, document)?.raw
                if (!NewDocument) continue
                string.push(NewDocument)
            }

            return this.BakeElementFromString(string.join(""))
        }
        //!

        const TagDocument = this.ModuleBundel._GetTag_(tag)?.document

        if (!TagDocument) return
        const ScriptTag = TagDocument._GetTag_("script")

        var AdaptedProps = InitialProps

        if (ScriptTag){
            AdaptedProps = Object.assign(
                AdaptedProps, 
                ScriptTag.document._EvaluateJavascript_(InitialProps)
            )
            TagDocument.raw = TagDocument.raw.replace(ScriptTag.full, "")
        }

        TagDocument.UpdateProperties(AdaptedProps)
        
        return TagDocument
    }

    //!Add function baking
}
