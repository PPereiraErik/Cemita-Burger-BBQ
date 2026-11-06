import gsap from 'gsap'
import { useGSAP } from '@gsap/react'

/* GSAP só onde o movimento é a interação: o caixão da entrada e o burger que desmonta. */
gsap.registerPlugin(useGSAP)
gsap.defaults({ ease: 'power3.out' })

export { gsap, useGSAP }
