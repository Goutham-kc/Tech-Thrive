import { render } from 'preact';
import  App  from './app';
import './index.css'; // <-- Add this

render(<App />, document.getElementById('app')!);